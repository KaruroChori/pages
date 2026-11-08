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

constexpr int kMaxK = 32;
constexpr int kMinPoints = 32;
constexpr int kMaxPoints = 2000;
constexpr std::uint32_t kHashSalt = 0x9e3779b9U;

std::uint32_t hash_u32(std::uint32_t x) {
    x ^= x >> 16;
    x *= 0x7feb352dU;
    x ^= x >> 15;
    x *= 0x846ca68bU;
    x ^= x >> 16;
    return x;
}

float random01(std::uint32_t index, std::uint32_t salt, std::uint32_t seed) {
    const std::uint32_t h = hash_u32(index * 747796405U + salt * kHashSalt + seed * 2654435761U);
    return static_cast<float>(h & 0x00ffffffU) * (1.0f / 16777215.0f);
}

using Limits = kd3::limits<float, 2>;
using Tree = kd3::KdTree<Limits, {.leaf_size = 8, .has_aabb = true}>;

std::vector<float> g_points;
std::vector<Tree::FatPoint> g_fat_points;
std::vector<float> g_leaf_boxes;
std::optional<Tree> g_tree;
int g_point_count = 0;
int g_knn_ids[kMaxK] = {};
float g_knn_dist2[kMaxK] = {};
int g_ray_id = -1;
float g_ray_t = -1.0f;

auto make_filter(int filter_mode) {
    return [filter_mode](std::uint32_t id, const auto&) -> bool {
        switch (filter_mode) {
            case 1: return (id % 2U) == 0U;
            case 2: {
                const std::size_t base = static_cast<std::size_t>(id) * 2;
                return g_points[base] > 0.5f;
            }
            case 3: return (id % 3U) != 0U;
            default: return true;
        }
    };
}

}  // namespace

extern "C" {

WASM_EXPORT("iface_build") int iface_build(int seed, int count) {
    count = std::clamp(count, kMinPoints, kMaxPoints);
    const auto useed = static_cast<std::uint32_t>(seed);

    g_points.resize(static_cast<std::size_t>(count) * 2);
    g_fat_points.resize(static_cast<std::size_t>(count));

    constexpr float centers[4][2] = {
        {0.22f, 0.28f},
        {0.77f, 0.24f},
        {0.31f, 0.77f},
        {0.78f, 0.75f},
    };

    for (int i = 0; i < count; ++i) {
        float x;
        float y;
        if (i % 9 == 0) {
            x = 0.04f + 0.92f * random01(static_cast<std::uint32_t>(i), 11, useed);
            y = 0.04f + 0.92f * random01(static_cast<std::uint32_t>(i), 12, useed);
        } else {
            const int cluster = i % 4;
            const float spread = 0.19f;
            x = centers[cluster][0] +
                (random01(static_cast<std::uint32_t>(i), 1, useed) +
                 random01(static_cast<std::uint32_t>(i), 2, useed) +
                 random01(static_cast<std::uint32_t>(i), 3, useed) - 1.5f) * spread;
            y = centers[cluster][1] +
                (random01(static_cast<std::uint32_t>(i), 4, useed) +
                 random01(static_cast<std::uint32_t>(i), 5, useed) +
                 random01(static_cast<std::uint32_t>(i), 6, useed) - 1.5f) * spread;
        }

        x = std::clamp(x, 0.02f, 0.98f);
        y = std::clamp(y, 0.02f, 0.98f);
        const std::size_t base = static_cast<std::size_t>(i) * 2;
        g_points[base + 0] = x;
        g_points[base + 1] = y;
        g_fat_points[static_cast<std::size_t>(i)] = {{x, y}, static_cast<std::uint32_t>(i)};
    }

    auto tree = Tree::build(g_fat_points);
    if (!tree) {
        g_tree.reset();
        g_point_count = 0;
        g_leaf_boxes.clear();
        return 0;
    }
    g_tree.emplace(std::move(*tree));
    g_point_count = count;

    const auto view = g_tree->view();
    const std::size_t bucket_count = view.buckets.size();
    g_leaf_boxes.resize(bucket_count * 4);
    for (std::size_t leaf = 0; leaf < bucket_count; ++leaf) {
        const auto& box = view.node_boxes[(bucket_count - 1) + leaf];
        g_leaf_boxes[leaf * 4 + 0] = box.minc[0];
        g_leaf_boxes[leaf * 4 + 1] = box.minc[1];
        g_leaf_boxes[leaf * 4 + 2] = box.maxc[0];
        g_leaf_boxes[leaf * 4 + 3] = box.maxc[1];
    }
    return count;
}

WASM_EXPORT("iface_point_count") int iface_point_count() { return g_point_count; }
WASM_EXPORT("iface_points") const float* iface_points() { return g_points.data(); }
WASM_EXPORT("iface_leaf_count") int iface_leaf_count() { return static_cast<int>(g_leaf_boxes.size() / 4); }
WASM_EXPORT("iface_leaf_boxes") const float* iface_leaf_boxes() { return g_leaf_boxes.data(); }

WASM_EXPORT("iface_query_1nn") int iface_query_1nn(float x, float y) {
    if (!g_tree) return -1;
    auto result = g_tree->query_1nn({x, y});
    return result ? static_cast<int>(result->payload_id) : -1;
}

WASM_EXPORT("iface_query_distance2") float iface_query_distance2(float x, float y) {
    if (!g_tree) return -1.0f;
    auto result = g_tree->query_distance2({x, y});
    return result ? static_cast<float>(*result) : -1.0f;
}

WASM_EXPORT("iface_query_knn") int iface_query_knn(float x, float y, int k) {
    if (!g_tree) return 0;
    k = std::clamp(k, 1, kMaxK);
    Tree::KnnResult buffer[kMaxK];
    auto result = g_tree->query_knn({x, y}, std::span<Tree::KnnResult>(buffer, k));
    if (!result) return 0;
    const int count = static_cast<int>(result->size());
    for (int i = 0; i < count; ++i) {
        g_knn_ids[i] = static_cast<int>((*result)[static_cast<std::size_t>(i)].payload_id);
        g_knn_dist2[i] = (*result)[static_cast<std::size_t>(i)].dist_sq;
    }
    return count;
}

WASM_EXPORT("iface_query_1nn_if") int iface_query_1nn_if(float x, float y, int filter_mode) {
    if (!g_tree) return -1;
    auto result = g_tree->query_1nn_if({x, y}, make_filter(filter_mode));
    return result ? static_cast<int>(result->payload_id) : -1;
}

WASM_EXPORT("iface_query_knn_if") int iface_query_knn_if(float x, float y, int k, int filter_mode) {
    if (!g_tree) return 0;
    k = std::clamp(k, 1, kMaxK);
    Tree::KnnResult buffer[kMaxK];
    auto result = g_tree->query_knn_if(
        {x, y}, std::span<Tree::KnnResult>(buffer, k), make_filter(filter_mode));
    if (!result) return 0;
    const int count = static_cast<int>(result->size());
    for (int i = 0; i < count; ++i) {
        g_knn_ids[i] = static_cast<int>((*result)[static_cast<std::size_t>(i)].payload_id);
        g_knn_dist2[i] = (*result)[static_cast<std::size_t>(i)].dist_sq;
    }
    return count;
}

WASM_EXPORT("iface_query_distance2_if") float iface_query_distance2_if(float x, float y, int filter_mode) {
    if (!g_tree) return -1.0f;
    auto result = g_tree->query_distance2_if({x, y}, make_filter(filter_mode));
    return result ? static_cast<float>(*result) : -1.0f;
}

WASM_EXPORT("iface_query_ray") int iface_query_ray(float ox, float oy, float dx, float dy, float max_t, float radius) {
    if (!g_tree) return -1;
    auto result = g_tree->query_ray({ox, oy}, {dx, dy}, max_t, radius);
    if (!result) {
        g_ray_id = -1;
        g_ray_t = -1.0f;
        return -1;
    }
    g_ray_id = static_cast<int>(result->payload_id);
    g_ray_t = static_cast<float>(result->t);
    return g_ray_id;
}

WASM_EXPORT("iface_query_ray_distance") float iface_query_ray_distance(float ox, float oy, float dx, float dy, float max_t, float radius) {
    if (!g_tree) return -1.0f;
    auto result = g_tree->query_ray_distance({ox, oy}, {dx, dy}, max_t, radius);
    if (!result) {
        g_ray_id = -1;
        g_ray_t = -1.0f;
        return -1.0f;
    }
    g_ray_t = static_cast<float>(*result);
    g_ray_id = -1;
    return g_ray_t;
}

WASM_EXPORT("iface_ray_id") int iface_ray_id() { return g_ray_id; }
WASM_EXPORT("iface_ray_t") float iface_ray_t() { return g_ray_t; }
WASM_EXPORT("iface_knn_ids") const int* iface_knn_ids() { return g_knn_ids; }
WASM_EXPORT("iface_knn_dist2") const float* iface_knn_dist2() { return g_knn_dist2; }

}  // extern "C"

int main() { return 0; }
