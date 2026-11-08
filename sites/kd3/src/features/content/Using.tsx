import { CodeBlock } from "@pages/ui/CodeBlock";

export function Using() {
  return (
<section id="interfaces" className="section">
    <header className="section-head">
      <h2>Build from runtime data, then query</h2>
      <p>
        The tree is constructed from a mutable span of points. It sorts the
        input, owns the resulting arrays, and returns an
        <code>std::expected</code>. Rebuild after data changes; the query view
        itself stays trivially copyable.
      </p>
    </header>

    <div className="internals-grid">
      <article className="info-card">
        <h3>From your own container</h3>
        <p>
          Build takes a mutable span of <code>FatPoint</code>. It partitions the
          data in place and allocates the final tree storage up front.
        </p>
        <CodeBlock code={'using Tree = kd3::KdTree<kd3::limits<float, 3>>;\nstd::vector<Tree::FatPoint> points;\n\nfor (const auto& sample : samples) {\n    points.push_back({sample.position, sample.id});\n}\n\nauto tree = Tree::build(points);\nif (!tree) return false;\n\nauto hit = tree->query_1nn(target);'} />
      </article>

      <article className="info-card">
        <h3>Scalar, dimension, distance, payload</h3>
        <p>
          <code>limits</code> controls all four. Higher-dimensional keys work
          for position plus normal. Integer scalars and wider distance
          accumulators are supported.
        </p>
        <CodeBlock code={'using Point2 = kd3::KdTree<kd3::limits<float, 2>>;\nusing Fixed5 = kd3::KdTree<\n    kd3::limits<std::int16_t, 5, std::int64_t, std::uint32_t>\n>;\nusing Oriented = kd3::KdTree<kd3::limits<float, 6>>;'} />
      </article>

      <article className="info-card">
        <h3>Same index, different answers</h3>
        <p>
          Queries return <code>std::expected</code>. k-NN writes into a caller
          buffer. Filtered queries take a predicate and never update the bound
          for rejected points.
        </p>
        <CodeBlock code={'auto nearest = tree->query_1nn(target);\n\nstd::array<Tree::KnnResult, 8> buffer;\nauto nearest8 = tree->query_knn(target, buffer);\n\nauto valid = tree->query_1nn_if(\n    target,\n    [&](std::uint32_t id, const auto&) {\n        return enabled[id];\n    });'} />
      </article>

      <article className="info-card">
        <h3>STB-style wrapper for FFI</h3>
        <p>
          Define <code>KD3_CXX_IMPL</code> once, include the C header elsewhere.
          It exposes create, destroy, 1-NN, k-NN, distance, and ray queries.
          Filtered queries remain C++ only for now.
        </p>
        <CodeBlock code={'#define KD3_CXX_IMPL\n#include <kd3/kd3-c.h>\n\nkd3_tree_t* tree = kd3_tree_create(points, n, &err);\nkd3_knn_result_t hit;\nkd3_tree_query_1nn(tree, target, &hit);\nkd3_tree_destroy(tree);'} />
      </article>

      <article className="info-card">
        <h3>Query functions for the GPU</h3>
        <p>
          Generates 1-NN, k-NN, and ray query functions for 2D to 4D trees. The
          generated code uses the same split and bucket layout as the CPU tree.
        </p>
        <CodeBlock code={'auto glsl = kd3::generate_glsl<\n    kd3::limits<float>,\n    Tree::cfg,\n    {.binding_vals = 1, .binding_dims = 2,\n     .binding_bks = 3, .binding_boxes = 4}\n>();'} />
        <p className="api-link">
          <a className="button" href="#glsl">See the GPU raytracing demo</a>
        </p>
      </article>

      <article className="info-card">
        <h3>Rebuild, do not mutate the view</h3>
        <p>
          The core tree is immutable. Rebuild after data changes, or use the
          example mutable wrapper. Keeping construction separate is what makes
          the view trivially copyable.
        </p>
        <CodeBlock code={'// After points change:\nauto rebuilt = Tree::build(points);\nif (rebuilt) tree = std::move(*rebuilt);\n\n// Or see examples/mutable/mut.hpp.'} />
      </article>
    </div>
  </section>
  );
}
