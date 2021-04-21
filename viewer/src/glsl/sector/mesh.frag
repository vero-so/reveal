#pragma glslify: derivateNormal = require('../math/derivateNormal.glsl')
#pragma glslify: updateFragmentColor = require('../base/updateFragmentColor.glsl')
#pragma glslify: determineColor = require('../base/determineColor.glsl');
#pragma glslify: determineVisibility = require('../base/determineVisibility.glsl');
#pragma glslify: isSliced = require('../base/isSliced.glsl', NUM_CLIPPING_PLANES=NUM_CLIPPING_PLANES, UNION_CLIPPING_PLANES=UNION_CLIPPING_PLANES)
#pragma glslify: GeometryType = require('../base/geometryTypes.glsl');

uniform sampler2D colorDataTexture;
uniform sampler2D overrideVisibilityPerTreeIndex;
uniform sampler2D matCapTexture;

uniform vec2 treeIndexTextureSize;

varying float v_treeIndex;
varying vec3 v_color;
varying vec3 v_viewPosition;

uniform int renderMode;

void main()
{
    if (!determineVisibility(colorDataTexture, treeIndexTextureSize, v_treeIndex, renderMode)) {
        discard;
    }

    if (isSliced(v_viewPosition)) {
        discard;
    }

    vec4 color = determineColor(v_color, colorDataTexture, treeIndexTextureSize, v_treeIndex);
    vec3 normal = derivateNormal(v_viewPosition);
    updateFragmentColor(renderMode, color, v_treeIndex, normal, gl_FragCoord.z, matCapTexture, GeometryType.TriangleMesh);
}
