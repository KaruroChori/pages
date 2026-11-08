set_policy("check.auto_ignore_flags", false)
add_repositories("xmake-chari-repo https://github.com/KaruroChori/xmake-chari-repo.git master")

add_rules("mode.release")
set_languages("c++23")
add_requires("omp-stub")

local common_cxflags = {"-fno-exceptions", "-fno-rtti", "-msimd128"}
local common_ldflags = {"-fno-exceptions", "-msimd128"}

target("kd3_web")
    set_kind("binary")
    set_extension(".wasm")
    add_files("demo.cpp")
    add_includedirs("../vendor/kd3/include")
    add_packages("omp-stub")
    add_cxflags(common_cxflags)
    add_ldflags(common_ldflags)

target("kd3_interface")
    set_kind("binary")
    set_extension(".wasm")
    add_files("interface_demo.cpp")
    add_includedirs("../vendor/kd3/include")
    add_packages("omp-stub")
    add_cxflags(common_cxflags)
    add_ldflags(common_ldflags)

target("kd3_glsl")
    set_kind("binary")
    set_extension(".wasm")
    add_files("glsl_demo.cpp")
    add_includedirs("../vendor/kd3/include")
    add_packages("omp-stub")
    add_cxflags(common_cxflags)
    add_ldflags(common_ldflags)
