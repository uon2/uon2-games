# 수채 낚시터 이미지 자산

2026-10-26. 내장 image_gen 도구로 생성했습니다. 게임에서 쓰는 최종 WebP 파일은 이 폴더에 저장했습니다. PNG 원본은 Codex generated_images에 보존되어 있습니다. 포맷 변환·크기 최적화만 수행했으며 투명도를 유지했습니다.

- pond.webp: 글자와 UI가 없는 수채 연못 배경.
- angler.webp: 긴 낚싯대 없이 손잡이를 든 아이. 긴 낚싯대와 줄은 canvas에서 그립니다.
- fish.webp: 한자 없는 밝은 몸통의 물고기. 실제 한자는 HTML 글꼴로 덧씁니다.

배경 345KB, 아이 127KB, 물고기 70KB 수준입니다. 이미지에 한자·UI를 굽지 않았으므로 글자를 검수·교체할 수 있습니다.

## 생성 프롬프트 원문

### pond

Use case: illustration-story. Production game background asset for a Korean children's peaceful watercolor fishing learning game. Landscape 3:2, high resolution. Original hand-painted watercolor picture-book illustration with visible cotton paper grain, soft pigment blooms, warm cream sunlight, sage green reeds and pale turquoise water. Genuinely charming premium children's illustration. A quiet little Korean garden pond seen slightly from above, broad open still pale turquoise water occupying middle 75 percent, a low far bank only in the top 20 percent with a small simple wooden footbridge in upper right, soft trees in corners. In lower left only a small wooden dock entering from left edge into pond, clean flat platform for a character sprite to sit on; NO PEOPLE. Sparse lotus leaves near upper-left bank and lower-right edge only. Central water MUST be clean and low-detail so moving fish and UI read easily. Minimal few fine ripples, subtle reflections, generous calm negative space. No fish, no rod, no fishing line, no bobber, no UI, no text, no letters, no logos, no frame. Avoid busy foliage, dense sparkle, stones throughout, thick dark outlines, pixel art, vector flatness, plastic 3d. Composition should remain readable on tablets. This is a usable background layer, not a mockup.

### angler

Use case: illustration-story. One isolated character sprite for a watercolor children's fishing game, transparent background. A small friendly gender-neutral Korean child wearing a wide woven straw hat with sage ribbon, cream shirt, sage green overalls, brown sandals. Sitting on a tiny wooden stool, side profile facing RIGHT, feet resting, torso relaxed, both hands together extended slightly forward at waist height, holding only a SHORT wooden fishing rod grip ending just after the hands. Do NOT draw the long fishing rod, line or bobber: those are animated separately in code. A small woven fishing basket beside the stool on the LEFT. Warm charming watercolor picture-book art, subtle cotton paper grain within painted shapes, peach cheeks, delicate same-color outlines, soft sunlit edges. Full body, all visible including hat and shoes, compact 3:4 framing. Transparent background, no ground plane, no scenery, no text, no border, no UI, no shadow rectangle. Clean cutout edges, no random decorative droplets. Looks like an actual illustrated storybook child, not an emoji or vector icon.

### fish

Use case: illustration-story. One isolated side-profile watercolor fish sprite for a children's fishing game, transparent background. Fish faces LEFT, soft rounded plump peach-gold Korean pond carp, elegant translucent flowing tail on RIGHT, gentle friendly black eye, soft apricot and ivory watercolor washes, a few subtle scales only near back, simple very pale ivory open body center RESERVED for a dark Hanja character rendered later. Original hand-painted watercolor picture-book quality with paper-grain pigment, feathered fin edges, beautiful warm sunlight. Single fish full silhouette including every fin, horizontal 3:2 composition. No text, no Hanzi, no Hanja, no symbol, no background, no water, no frame, no extra fish, no ground shadow, no pixel art, no thick black outline, no sticker border. Transparent background. Highly readable body and clean transparent margins.

