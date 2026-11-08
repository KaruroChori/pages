#include <kd3/glsl.hpp>
#include <kd3/kd3.hpp>

#include <array>
#include <cmath>
#include <cstdint>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#if defined(__wasm__)
#define WASM_EXPORT(name) __attribute__((export_name(name)))
#else
#define WASM_EXPORT(name)
#endif

namespace {

constexpr int kT = 300;
constexpr int kP = 60;
constexpr int kSurfelCount = kT * kP;
constexpr float kMajorRadius = 0.92f;
constexpr float kMinorRadius = 0.42f;
constexpr float kTubeRadius = 0.09f;
constexpr int kPp = 2;
constexpr int kQ = 3;
constexpr float kPi = 3.14159265358979323846f;

using Limits = kd3::limits<float, 3>;
constexpr kd3::cfg_t TreeCfg{
    .max_stack_depth = 128,
    .leaf_size = 1,
    .has_aabb = true,
};
using Tree = kd3::KdTree<Limits, TreeCfg>;

std::optional<Tree> g_tree;
std::vector<Tree::FatPoint> g_fat_points;
std::vector<float> g_normals;
std::string g_glsl;
float g_root_min[3] = {};
float g_root_max[3] = {};
int g_split_vals_count = 0;
int g_split_dims_count = 0;
int g_buckets_count = 0;
int g_boxes_count = 0;
int g_num_buckets = 0;
int g_surfel_count = 0;

std::uint32_t hash_u32(std::uint32_t x) {
    x ^= x >> 16;
    x *= 0x7feb352dU;
    x ^= x >> 15;
    x *= 0x846ca68bU;
    x ^= x >> 16;
    return x;
}

float random01(std::uint32_t index, std::uint32_t salt) {
    const std::uint32_t h = hash_u32(index * 747796405U + salt * 0x9e3779b9U);
    return static_cast<float>(h & 0x00ffffffU) * (1.0f / 16777215.0f);
}


float dot3(const float a[3], const float b[3]) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

void cross3(const float a[3], const float b[3], float out[3]) {
    out[0] = a[1] * b[2] - a[2] * b[1];
    out[1] = a[2] * b[0] - a[0] * b[2];
    out[2] = a[0] * b[1] - a[1] * b[0];
}

void normalize3(float v[3]) {
    const float length = std::sqrt(dot3(v, v));
    if (length > 0.0f) {
        v[0] /= length;
        v[1] /= length;
        v[2] /= length;
    }
}

void centerline(float t, float out[3]) {
    const float ct = std::cos(static_cast<float>(kPp) * t);
    const float st = std::sin(static_cast<float>(kPp) * t);
    const float cq = std::cos(static_cast<float>(kQ) * t);
    const float sq = std::sin(static_cast<float>(kQ) * t);
    const float ring = kMajorRadius + kMinorRadius * cq;
    out[0] = ring * ct;
    out[1] = kMinorRadius * sq;
    out[2] = ring * st;
}

void centerline_tangent(float t, float out[3]) {
    constexpr float eps = 0.002f;
    float a[3];
    float b[3];
    centerline(t - eps, a);
    centerline(t + eps, b);
    out[0] = b[0] - a[0];
    out[1] = b[1] - a[1];
    out[2] = b[2] - a[2];
    normalize3(out);
}

void build_scene() {
    g_fat_points.resize(kSurfelCount);
    g_normals.assign(static_cast<std::size_t>(kSurfelCount) * 4, 0.0f);

    float mn[3] = {1e9f, 1e9f, 1e9f};
    float mx[3] = {-1e9f, -1e9f, -1e9f};

    std::vector<std::array<float, 3>> frame_n(static_cast<std::size_t>(kT));
    std::vector<std::array<float, 3>> frame_b(static_cast<std::size_t>(kT));

    float previous_n[3] = {0.0f, 0.0f, 0.0f};
    for (int i = 0; i < kT; ++i) {
        const float t = 2.0f * kPi * (static_cast<float>(i) + 0.5f) /
                        static_cast<float>(kT);
        float tangent[3];
        float n[3];
        float b[3];
        centerline_tangent(t, tangent);

        if (i == 0) {
            const float up[3] = {0.0f, 1.0f, 0.0f};
            cross3(tangent, up, n);
            if (dot3(n, n) < 1e-8f) {
                n[0] = 1.0f;
                n[1] = 0.0f;
                n[2] = 0.0f;
            }
        } else {
            const float projection = dot3(previous_n, tangent);
            n[0] = previous_n[0] - tangent[0] * projection;
            n[1] = previous_n[1] - tangent[1] * projection;
            n[2] = previous_n[2] - tangent[2] * projection;
            if (dot3(n, n) < 1e-8f) {
                const float up[3] = {0.0f, 1.0f, 0.0f};
                cross3(tangent, up, n);
            }
        }
        normalize3(n);
        cross3(tangent, n, b);
        normalize3(b);

        frame_n[static_cast<std::size_t>(i)] = {n[0], n[1], n[2]};
        frame_b[static_cast<std::size_t>(i)] = {b[0], b[1], b[2]};
        previous_n[0] = n[0];
        previous_n[1] = n[1];
        previous_n[2] = n[2];
    }

    for (int i = 0; i < kT; ++i) {
        for (int j = 0; j < kP; ++j) {
            const int index = i * kP + j;
            const float jitter_t = (random01(static_cast<std::uint32_t>(index), 1) - 0.5f) * 0.15f;
            const float jitter_p = (random01(static_cast<std::uint32_t>(index), 2) - 0.5f) * 0.15f;
            const float t = 2.0f * kPi *
                            (static_cast<float>(i) + 0.5f + jitter_t) /
                            static_cast<float>(kT);
            const float phi = 2.0f * kPi *
                              (static_cast<float>(j) + 0.5f + jitter_p) /
                              static_cast<float>(kP);

            float center[3];
            centerline(t, center);
            const auto& n_frame = frame_n[static_cast<std::size_t>(i)];
            const auto& b_frame = frame_b[static_cast<std::size_t>(i)];
            const float cp = std::cos(phi);
            const float sp = std::sin(phi);

            const float p[3] = {
                center[0] + kTubeRadius * (cp * n_frame[0] + sp * b_frame[0]),
                center[1] + kTubeRadius * (cp * n_frame[1] + sp * b_frame[1]),
                center[2] + kTubeRadius * (cp * n_frame[2] + sp * b_frame[2]),
            };
            float n[3] = {
                cp * n_frame[0] + sp * b_frame[0],
                cp * n_frame[1] + sp * b_frame[1],
                cp * n_frame[2] + sp * b_frame[2],
            };
            normalize3(n);

            g_fat_points[static_cast<std::size_t>(index)] = {
                {p[0], p[1], p[2]},
                static_cast<std::uint32_t>(index),
            };

            const std::size_t nb = static_cast<std::size_t>(index) * 4;
            g_normals[nb + 0] = n[0];
            g_normals[nb + 1] = n[1];
            g_normals[nb + 2] = n[2];
            g_normals[nb + 3] = std::fmod(
                t / (2.0f * kPi) + 0.25f * phi / (2.0f * kPi), 1.0f);

            for (int d = 0; d < 3; ++d) {
                mn[d] = std::fmin(mn[d], p[d]);
                mx[d] = std::fmax(mx[d], p[d]);
            }
        }
    }

    auto built = Tree::build(g_fat_points);
    if (!built) {
        g_tree.reset();
        g_surfel_count = 0;
        return;
    }
    g_tree.emplace(std::move(*built));

    const auto view = g_tree->view();
    g_split_vals_count = static_cast<int>(view.split_vals.size());
    g_split_dims_count = static_cast<int>(view.split_dims.size());
    g_buckets_count = static_cast<int>(
        view.buckets.size() * sizeof(typename Tree::LeafBucket) / sizeof(std::uint32_t));
    g_boxes_count = static_cast<int>(view.node_boxes.size() * (2 * Limits::D));
    g_num_buckets = static_cast<int>(view.buckets.size());
    g_surfel_count = kSurfelCount;

    constexpr float pad = 0.02f;
    for (int d = 0; d < 3; ++d) {
        g_root_min[d] = mn[d] - pad;
        g_root_max[d] = mx[d] + pad;
    }

    constexpr kd3::GlslConfig glsl_cfg{
        .binding_vals = 0,
        .binding_dims = 1,
        .binding_bks = 2,
        .binding_boxes = 3,
        .max_stack_depth = 128,
    };
    g_glsl = kd3::generate_glsl<Limits, TreeCfg, glsl_cfg>("kd3");
}

}  // namespace

extern "C" {

WASM_EXPORT("glsl_build") int glsl_build() {
    build_scene();
    return g_surfel_count;
}

WASM_EXPORT("glsl_surfel_count") int glsl_surfel_count() { return g_surfel_count; }
WASM_EXPORT("glsl_normals") const float* glsl_normals() { return g_normals.data(); }

WASM_EXPORT("glsl_split_vals") const float* glsl_split_vals() {
    return g_tree ? g_tree->view().split_vals.data() : nullptr;
}
WASM_EXPORT("glsl_split_vals_count") int glsl_split_vals_count() { return g_split_vals_count; }

WASM_EXPORT("glsl_split_dims") const std::uint64_t* glsl_split_dims() {
    return g_tree ? g_tree->view().split_dims.data() : nullptr;
}
WASM_EXPORT("glsl_split_dims_count") int glsl_split_dims_count() { return g_split_dims_count; }

WASM_EXPORT("glsl_buckets") const std::uint32_t* glsl_buckets() {
    return g_tree ? reinterpret_cast<const std::uint32_t*>(g_tree->view().buckets.data())
                  : nullptr;
}
WASM_EXPORT("glsl_buckets_count") int glsl_buckets_count() { return g_buckets_count; }

WASM_EXPORT("glsl_boxes") const float* glsl_boxes() {
    return g_tree ? reinterpret_cast<const float*>(g_tree->view().node_boxes.data()) : nullptr;
}
WASM_EXPORT("glsl_boxes_count") int glsl_boxes_count() { return g_boxes_count; }

WASM_EXPORT("glsl_num_buckets") int glsl_num_buckets() { return g_num_buckets; }
WASM_EXPORT("glsl_root_min") const float* glsl_root_min() { return g_root_min; }
WASM_EXPORT("glsl_root_max") const float* glsl_root_max() { return g_root_max; }

WASM_EXPORT("glsl_source") const char* glsl_source() { return g_glsl.c_str(); }
WASM_EXPORT("glsl_source_len") int glsl_source_len() {
    return static_cast<int>(g_glsl.size());
}

}  // extern "C"
