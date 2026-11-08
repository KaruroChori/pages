#include <kd3/kd3.hpp>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <optional>
#include <span>
#include <utility>
#include <vector>

#if defined(__wasm__)
#define WASM_EXPORT(name) __attribute__((export_name(name)))
#else
#define WASM_EXPORT(name)
#endif


namespace {

constexpr int kPointCount = 7000;
constexpr int kMaxK = 32;
constexpr float kPi = 3.14159265358979323846f;

struct Vec3 {
    float x = 0.0f;
    float y = 0.0f;
    float z = 0.0f;
};

inline Vec3 operator+(Vec3 a, Vec3 b) { return {a.x + b.x, a.y + b.y, a.z + b.z}; }
inline Vec3 operator-(Vec3 a, Vec3 b) { return {a.x - b.x, a.y - b.y, a.z - b.z}; }
inline Vec3 operator*(Vec3 a, float s) { return {a.x * s, a.y * s, a.z * s}; }

inline float dot(Vec3 a, Vec3 b) { return a.x * b.x + a.y * b.y + a.z * b.z; }

inline Vec3 cross(Vec3 a, Vec3 b) {
    return {a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x};
}

inline Vec3 normalize(Vec3 v) {
    const float len = std::sqrt(dot(v, v));
    return len > 1.0e-8f ? v * (1.0f / len) : Vec3{0.0f, 1.0f, 0.0f};
}

inline std::uint32_t hash_u32(std::uint32_t x) {
    x ^= x >> 16;
    x *= 0x7feb352dU;
    x ^= x >> 15;
    x *= 0x846ca68bU;
    x ^= x >> 16;
    return x;
}

inline float random01(std::uint32_t index, std::uint32_t salt) {
    const std::uint32_t h = hash_u32(index * 747796405U + salt * 2891336453U);
    return static_cast<float>(h & 0x00ffffffU) * (1.0f / 16777215.0f);
}

// Trefoil knot.
Vec3 curve(float t) {
    const float s = std::sin(t);
    const float c = std::cos(t);
    return {
        s + 2.0f * std::sin(2.0f * t),
        c - 2.0f * std::cos(2.0f * t),
        -std::sin(3.0f * t),
    };
}

Vec3 tangent(float t) {
    constexpr float e = 1.0e-3f;
    return normalize(curve(t + e) - curve(t - e));
}

using Limits = kd3::limits<float, 3>;
using Tree = kd3::KdTree<Limits, {.leaf_size = 8, .has_aabb = true}>;

std::vector<float> g_points;
std::vector<Tree::FatPoint> g_fat_points;
std::optional<Tree> g_tree;
int g_knn_ids[kMaxK] = {};
float g_knn_dist2[kMaxK] = {};

}  // namespace

extern "C" {

WASM_EXPORT("demo_init") int demo_init() {
    g_points.resize(static_cast<std::size_t>(kPointCount) * 3);
    g_fat_points.resize(static_cast<std::size_t>(kPointCount));

    const Vec3 up{0.0f, 1.0f, 0.0f};
    for (int i = 0; i < kPointCount; ++i) {
        const float t = 2.0f * kPi * random01(static_cast<std::uint32_t>(i), 1);
        const float angle = 2.0f * kPi * random01(static_cast<std::uint32_t>(i), 2);
        const float tube = 0.32f * (0.75f + 0.25f * random01(static_cast<std::uint32_t>(i), 3));

        const Vec3 tan = tangent(t);
        const Vec3 normal = normalize(cross(tan, up));
        const Vec3 binormal = normalize(cross(tan, normal));
        const Vec3 p = (curve(t) + normal * (std::cos(angle) * tube) +
                        binormal * (std::sin(angle) * tube)) *
                       0.45f;

        const std::size_t base = static_cast<std::size_t>(i) * 3;
        g_points[base + 0] = p.x;
        g_points[base + 1] = p.y;
        g_points[base + 2] = p.z;
        g_fat_points[static_cast<std::size_t>(i)] = {{p.x, p.y, p.z},
                                                     static_cast<std::uint32_t>(i)};
    }

    auto tree = Tree::build(g_fat_points);
    if (!tree) return 0;
    g_tree.emplace(std::move(*tree));
    return kPointCount;
}

WASM_EXPORT("demo_point_count") int demo_point_count() { return kPointCount; }

WASM_EXPORT("demo_points") const float* demo_points() { return g_points.data(); }

WASM_EXPORT("demo_query_1nn") int demo_query_1nn(float x, float y, float z) {
    if (!g_tree) return -1;
    auto result = g_tree->query_1nn({x, y, z});
    return result ? static_cast<int>(result->payload_id) : -1;
}

WASM_EXPORT("demo_query_dist2") float demo_query_dist2(float x, float y, float z) {
    if (!g_tree) return -1.0f;
    auto result = g_tree->query_distance2({x, y, z});
    return result ? static_cast<float>(*result) : -1.0f;
}

WASM_EXPORT("demo_query_knn") int demo_query_knn(float x, float y, float z, int k) {
    if (!g_tree) return 0;
    k = std::clamp(k, 1, kMaxK);
    Tree::KnnResult buffer[kMaxK];
    auto result = g_tree->query_knn({x, y, z}, std::span<Tree::KnnResult>(buffer, k));
    if (!result) return 0;

    const int count = static_cast<int>(result->size());
    for (int i = 0; i < count; ++i) {
        g_knn_ids[i] = static_cast<int>((*result)[static_cast<std::size_t>(i)].payload_id);
        g_knn_dist2[i] = (*result)[static_cast<std::size_t>(i)].dist_sq;
    }
    return count;
}

WASM_EXPORT("demo_knn_ids") const int* demo_knn_ids() { return g_knn_ids; }
WASM_EXPORT("demo_knn_dist2") const float* demo_knn_dist2() { return g_knn_dist2; }

}  // extern "C"

int main() { return 0; }
