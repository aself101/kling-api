> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# API Updates

> Source: https://kling.ai/document-api/updates/api
> Locale: en
> Current Tab: API Updates
> This content is optimized for LLMs. In-page tabs are expanded and UI-only controls are omitted.

---

## 09/15/2026

**[Virtual Try-On] Version 3.0 Officially Released**

- Virtual Try-On has been fully upgraded, with significant improvements in model face consistency and overall image quality.

- Supports various clothing image inputs, including flat-lay images, mannequin images, and on-model images.

- Supports locking the model's pose, preserving the model's face, and choosing whether to retain the original background.

- This upgrade is compatible with existing users. V1/V1.5 model parameters have been adapted on the engineering side, allowing users to seamlessly switch to the 3.0 pipeline.
## 09/10/2026

**Video Generation | Video Effects | Effects Update**

- 10 video effects have been updated: 3d_cartoon_2, guardian_spirit, pet_dance, running_man, pet_moto_rider, swing_swing, day_to_night, throne_of_king, skateskate, surfsurf. For pricing changes, please refer to the [Effects Pricing List](https://kling.ai/document-api/video-effect-price)

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/quickStart/productIntroduction/effectsCenter)

## 09/07/2026

**[Video Commerce] API & Agent Launch**

- Introducing Video Commerce, which lets you upload a character image and voiceover script to quickly generate talking-head videos.

- The system automatically routes your input into two workflows based on whether product assets are provided. With only a character and script, it generates a creator-style talking-head video featuring the character throughout. Add product images and information to generate a product promotion video with automatically arranged shots of the character presenting, the character and product together, and close-ups of the product.

- This launch supports both API and Agent. Businesses can generate videos directly through Agent Market with no development required, while developers can integrate via API.

- Supports customization of audio speed, aspect ratio, resolution, voice, speech rate, and background music.

## 09/04/2026

**Video Generation | Video Effects | New Feature**

- Launch of 8 new video effects: net_the_fish, birthday_board, summer_fireworks, blow_blaze, champagne_birthday, pet_working_daily, pet_roll_window, pet_crash_earth

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/quickStart/productIntroduction/effectsCenter)

## 08/21/2026

**[Goods Studio] API and Agent Now Available**

- The new Goods Studio is now live, allowing users to upload product information and quickly generate product videos.

- The system automatically analyzes product images and key selling points to create dynamic visuals with compelling narratives and strong marketing appeal.

- This release supports both API and Agent access: merchants can use it online through Agent Market to generate videos without development work, while developers can integrate the capability via API.

- Supports configurable video duration, aspect ratio, and resolution.

**Video Generation | Video Effects | New Feature**

- Launch of 3 new video effects: makeup_style, hair_dressup, barbie_transform

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/quickStart/productIntroduction/effectsCenter)

## 08/18/2026

**[AI Apparel Replicator] API and Agent Now Available**

- The new AI Apparel Replicator capability is now live, enabling users to quickly generate new videos showcasing their own apparel products based on a viral reference video.

- The system can replace the product in the reference video with the user-uploaded product, while closely replicating the original video's presentation rhythm, camera language, body motion, scene atmosphere, and product display style.

- This release supports both API and Agent access: merchants can use it online through Agent Market to generate videos without development work, while developers can integrate the capability via API.

- Users can configure the model, BGM, and product introduction method. Product introductions support either voiceover or talking-head video.

- This capability is currently designed mainly for apparel products. Scenes are reused from the reference video by default. The generated result will try to match the reference video, but may not be exactly identical.

## 08/10/2026

**Video Generation | Video Effects | New Feature**

- Launch of 1 new video effects: magic_world_vlog_9_16

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/quickStart/productIntroduction/effectsCenter)

## 08/07/2026

**Kling API | New Feature: Webhook Signature Support**

- **Added Webhook Signature support**: Verify callback requests identity and confirm that requests are sent from the Kling API, and improve the security of callback integrations.
- **Added Test Callback**: Send test callback requests to quickly verify your callback configuration.
- **Added Webhook Secret Management**: Create, rotate, and delete Webhook Secrets to simplify the management of secrets used for callback signature verification.

If Webhook Signature is not enabled, no changes are required to your existing callback integration. Existing functionality remains fully compatible.

Updated developer documentation, including the [Callback Protocol →](https://kling.ai/document-api/api/get-started/callbacks), [Webhook Signature Integration Guide →](https://kling.ai/document-api/api/get-started/callbacks#configuration), [SDK Examples →](https://kling.ai/document-api/api/get-started/callbacks#sdk-examples), and [FAQ →](https://kling.ai/document-api/api/get-started/callbacks#faq).

## 08/03/2026

**Video Generation | Video Effects | New Feature**

- Launch of 3 new video effects: critter_paste, wiggle_faces_pets, paw_headbang

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/quickStart/productIntroduction/effectsCenter)

## 07/24/2026

**Video Generation | Video Effects | New Feature**

- Launch of 9 new video effects: food_splash, dj_pet, pet_diving, disco_paws, pet_fitness, j_var_live, pet_burst, idol_live, puff_cheeks

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/quickStart/productIntroduction/effectsCenter)

## 07/15/2026

**General | Feature Upgrade: More video models support the new API (same as Kling 3.0 Turbo API)**

- The new API features a simpler structure and lower parameter coupling, and supports batch queries by task ID and cursor-based pagination.
- Models added in this update: Kling 3.0, Kling 3.0 Omni, Kling 3.0 Motion Control, Kling 2.6, Kling 2.6 Motion Control, Kling 2.5 Turbo.
- The legacy API will continue to be available with no current plans for deprecation.
- Support exporting Markdown documents and quick integration with programming tools.

## 07/06/2026

**General | New Feature Launched: Supports Exporting Deduction Details through API**

- Supports querying resource package deduction details and balance deduction details. Please distinguish between the APIs.
- When querying deduction details, filtering can be performed based on criteria such as time, API Key, resource package ID, and resource package name.
- Supports multi-criteria filtering, taking the intersection of conditions of the same type and the union of conditions of different types.
- Supports the commonly used cursor query method in the industry. When using cursor query, keep the filtering criteria consistent with the initial query.

## 07/03/2026

**Video Generation | Video Effects | New Feature**

- Launch of 4 new video effects: african_sway, jealousy_sway, chubby_fish, shrug_dance

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/quickStart/productIntroduction/effectsCenter)

- Notice: magic_match_tree will be discontinued on July 3rd, 2026

## 06/25/2026

**Video Generation | Video Effects | New Feature**

- Launch of 1 new video effects: soccer_star

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/quickStart/productIntroduction/effectsCenter)

## 06/18/2026

**Video Generation | Video Effects | New Feature**

- Launch of 8 new video effects: bra_hot_dance, arg_hot_dance, fra_hot_dance, bra_goal, arg_goal, por_goal, victory_slide, samba_fever

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/quickStart/productIntroduction/effectsCenter)

## 06/17/2026

**Video Generation | Kling 3.0 Turbo Officially Released**

- Supports both text-to-video and image-to-video generation in 720P and 1080P
- Billing policy: Charged based on the duration of the generated video. 0.8 units are deducted per second for 720P generation, and 1.0 unit is deducted per second for 1080P generation
- Parameter optimization reduces parameter conflicts, making integration easier
- The new API supports authentication via API Key only. Please migrate as soon as possible

**Video Generation | Feature Upgrade: 3.0 Omni Now Supports Reference Videos up to 15 Seconds and 4K Generation**

- Reference video duration has been expanded to 3–15 seconds, and 4K video generation is now supported
- When a reference video is used as a feature reference, multi-shot video generation is supported. The required parameter settings are as follows: set multi_shot to true, set shot_type to intelligence, and include multi-shot scene descriptions in the prompt
- Billing policy: Charged based on the duration of the generated video, with 3 units deducted per second

**General | New Authentication Method Released**

- Authentication can now be completed using only an API Key, reducing integration complexity
- Fully compatible with existing models and can be used alongside AK/SK authentication

**General | Official Element Library Expanded**

- Two new preset elements have been added: Grace and Armored Youth

## 06/12/2026

**Video Generation | Video Effects | New Feature**

- Launch of 3 new video effects: bicycle_kick, football_dance_2, red_card_sent_off

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/quickStart/productIntroduction/effectsCenter)

## 06/05/2026

**Video Generation | Video Effects | New Feature**

- Launch of 4 new video effects: football_dance, magic_world_vlog, air_dunk, whirling_beverage_9_16

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/quickStart/productIntroduction/effectsCenter)

## 05/20/2026

**Video Generation | Video Effects | New Feature**

- Launch of 2 new video effects: tennis_trend, tennis_trend_9_16

- Special Effects Optimization:
    - korean_baseball: support for animal image input
    - football_live: optimized jersey design
    - football_live_9_16: optimized jersey design

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/quickStart/productIntroduction/effectsCenter)

## 05/15/2026

**Video Generation | Video Effects | New Feature**

- Launch of 2 new video effects: football_live_9_16, whirling_beverage

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 05/14/2026

**Video Generation | Video Effects | New Feature**

- Launch of 2 new video effects: f1_live, football_live

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 05/13/2026

**Video Generation | Video Effects | New Feature**

- Launch of 2 new video effects: korean_baseball_9_16, spielberg_transition

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 05/11/2026

**Video Generation | Video Effects | New Feature**

- Launch of 1 new video effects: korean_baseball

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 05/08/2026

**Video Generation | Video Effects | New Feature**

- Launch of 2 new video effects: pet_skateboard and daily_ootd

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 05/07/2026

**Video generation | Feature upgrade: supports defining the first and last frames when generating multi-shot videos**

- Remove the mutual exclusion between the "multi-shot" and "first and last frames" functions, allowing users to set the content of the first and last frames when generating multi-shot videos

- Supported model ranges: `kling-v3-omni`, `kling-v3`

## 04/27/2026

**Image Generation | Feature upgrade: Supports for intelligently setting the number of images generated for a photo album based on the content of prompt words**

- Implementation method: Set the value of the `series_amount` parameter to `auto`

- When using `auto`, it will occupy a concurrency amount corresponding to the actual generated quantity

## 04/24/2026

**Video Generation | Video Effects | New Feature**

- Launch of 17 new video effects: tiny_beast_printer, landmark_reveal, winter_charm, flash_ride, shooting_star, sovereign_scepter, return_of_the_king, minimalist_light, martial_meow, knock_at_a_door_revenge, sassy_shake, etc

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 04/23/2026

**Video generation | Feature upgrade: support for native 4K resolution output**

- Implementation method: Set the `mode` parameter value to `4k`, and you can generate a video with high expressiveness and a resolution of 4K, just like in PRO mode

- Support scope:
    - Omni-Video: The `kling-v3-omni` model supports all functions except for "reference video"
    - Text-to-Video: `kling-v3` model
    - Image-to-Video: `kling-v3` model

- Billing policy: Charged based on the duration of the generated video, with 3 units deducted per second

## 04/08/2026

**Video Generation | Video Effects | New Feature**

- Launch of 17 new video effects: perler_beads, spring_bloom, palm_sized_figure_pro, prank_box, lucky_veggie, toss_run, switch_to_silk, studio_look, etc

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 04/01/2026

**Video Generation | 3.0 Omni: Elaborate on the impact of reference videos on video character element, multi-image element, and the number of reference images**

- For details, see the parameter descriptions for the image_list and element_list parameters.

- This update only provides detailed explanations, and remains consistent with the original logic.

## 03/23/2026

**General | Multi-image elements also support binding timbres**

- Previously, only video character elements supported binding to voices.

- The voice binding method for multi-image elements is consistent with that of video character elements, and can be achieved by passing parameters through element_voice_id

## 03/18/2026

**Video Generation | Video Effects | New Feature**

- Launch of 6 new video effects: flash_drive, shush_my_dreams, french_elegance, finger_swipe, advent_of_flora, smooth_transition

- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 03/11/2026

**Video Generation | 3.0 Omni supports intelligence shot type**

- When the value of the shot_type parameter is set to `intelligence`, intelligent storyboarding can be achieved

Video Generation | Elaborate on some business logic descriptions

- When generating the start & end frames of a video using the`kling-video-o1` model, referencing a element is not supported.

- Customizing elements through video only supports the creation of realistic-style, humanoid element.

- In the code for Create Element API, the format of the `element_voice_id` parameter is set to string.

- Multi-camera does not support the start & end frames.

- When the image is not the first or last frame, do not pass the type parameter.

- Description of the model range supported by the tone control function.

## 03/04/2026

**Video Generation | V3.0 Motion Control Launched**

- You can enhance element consistency by binding the element, and when binding the element, you can only refer to the orientation of the person in the video.
- Add model_name parameter to distinguish model versions, default `kling-v2-6`
- For generating STD mode motion control videos, 0.9 units will be deducted per second; for generating PRO mode motion control videos, 1.2 units will be deducted per second.

## 02/27/2026

**Video Generation | Video Effects | New Feature**

- Launch of 1 new video effects: raid_check
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 02/25/2026

**Video Generation | 3.0 Omni and V3 model launched**

**Image Generation | 3.0 Omni and V3 model launched**

**General | The elements features have been fully upgraded**

- Supports the creation of elements through video, and when creating elements, it is possible to bind voice and use them to specify the voice during video generation.
- Upgrade the creation element to an asynchronous service to fulfill more element-related functions.
- The new element service adopts a brand-new API (advanced-custom-elements). The existing API can still be used normally, but the elements library is relatively independent and cannot perform cross-API queries.

## 02/11/2026

**Video Generation | Video Effects | New Feature**

- Launch of 10 new video effects: snow_night_kiss, eternal_kiss, fortune_in_motion, chinese_trend, sedan_chair_dance, skyfall, good_luck_dance, laicai_dance, yangge_dance, and horse_year_dance
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 02/04/2026

**Video Generation | Video Effects | New Feature**

- Launch of 8 new video effects: unique_firework, palm_sized_figure, color_mixing, lantern_festival_cuju, tangyuan_to_animal, etc
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 02/03/2026

**Video Generation | Video Effects | New Feature**

- Launch of 9 new video effects: hot_feet_dance, swag_dance, pigeon_dance, chanel_dance, city_to_village, etc
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 01/27/2026

**Video Generation | Video Effects | New Feature**

- Launch of 7 new video effects: new_year_feast, ring_in_new, pet_vlogger, crystal_horse, lateral_shift_transitionl,horse_year_firework, etc​​
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 01/23/2026

**General | New Capability: Supports intelligent completion of images from different angles of the element**

- Through the front view of the element, other angle images of the element can be automatically inferred, and three sets of results can be generated for selection each time.
- Charged based on the times of service visits, with 0.5 units deducted per visit.

**General | New Capability: When querying the task results, you can directly obtain the units consumed by the current task**

- The key of JSON parameter is: final_unit_deduction.

**General | New feature: When generating images or videos, a watermark can be added simultaneously**

- When the enabled parameter in watermark_info is set to true during parameter input, a watermarked result can be generated simultaneously.
- The watermark_url parameter of the returned result is the watermarked version.
- Currently, only some APIs support watermarking. For details, please refer to the current API documentation.

## 01/16/2026

**Video Generation | Video Effects | New Feature**

- Launch of 31 new video effects: drunk_dance, daoma_dance, lion_dance, lucky_money_come, phantom_jewel, zoom_out, etc​​
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 12/22/2025

**Video Generation | Motion Control Launched**

- Based on the new API path, both reference images and reference videos need to be uploaded simultaneously.
- Supports standard mode and high-quality mode. When generating standard mode videos, 0.5 points are deducted per second, and when generating high-quality mode videos, 0.8 points are deducted per second. The seconds are rounded to the nearest integer.
- The upper limit of the reference video duration is related to the orientation of the generated video characters: up to 30 seconds when consistent with the reference video, and only 10 seconds when consistent with the reference image.
- Action libraries are not currently supported.

## 12/18/2025

**Video Generation | Video Effects | New Feature**

- Launch of 16 new video effects: cheers_2026, countdown_teleport, santa_random_surprise, birthday_star, etc​​
- Notice:kiss,fight,hug,thumbs_up,tiger_hug,pet_lion, 3d_cartoon_1 will be discontinued on January 30, 2026
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 12/16/2025

**Video Generation | V2.6 model upgraded**

- By using prompt and voice_list, a specified voice can be used to generate videos: 6 units will be deducted for 5 seconds, and 12 units will be deducted for 10 seconds.
- Supports voice customization and can also use system preset voice.

## 12/15/2025

**Video Generation | V2.6 model launched**

- Supports Text-To-Video and Image-To-Video.
- Control whether to include audio when generating videos through the sound parameter.

**Video Generation | Omni-Video model launched**

- New API, multiple feature can be achieved through prompt words alone.

**Image Generation | Omni-Image model launched**

- New API, multiple feature can be achieved through prompt words alone.

## 12/11/2025

**Video Generation | Video Effects | New Feature**

- Launch of 20 new Christmas, New Year, and Winter-themed effects: firework_2026, santa_gift, scarlet_and_snow, etc​​
- Notice:celebration and c4d_cartoon will be discontinued on December 30, 2025
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 12/04/2025

**Avatar | Ability upgrade, supporting the generation of 5-minute avatar videos**

- No sensory upgrade, no need to modify API parameters

## 11/25/2025

**Video Generation | Video Effects | New Feature**

- Launch of "Single Image Effects":balloon_parade, jumping_ginger_joy, bullet_time, etc.​​
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 11/19/2025

**Video Generation | Video Effects | New Feature**

- Launch of "Single Image Effects":luminous_elf, guardian_spirit, snowboarding, etc.​​
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

**Multi-Image to Image | Support V2.1 model**

- Deduct 16 units when generate an image

## 11/17/2025

**Image-To-Video | V2.5-Turbo PRO supports First/Last Frame**

- Passing in the image parameter value and image_tail parameter value can achieve this
- Deduct 2.5 units when generate a 5-second video,and deduct 5 units when generate a 10-second video

## 11/11/2025

**Video Generation | V2.5-Turbo supports STD Mode**

- Including "Text-To-Video" and "Image-To-Video"
- Deduct 1.5 units when generate a 5-second video,and deduct 3 units when generate a 10-second video

## 11/03/2025

**Avatar | Video generation efficiency improved, compressing the original hourly time to 10 minutes+**

- No need to modify any code.

## 10/27/2025

**Video Generation | Video Effects | New Feature**

- Launch of 10 Halloween special effects: pumpkin_head_transform, cute_ghost_transform, knock_knock_halloween, halloween_escape​, etc.​​
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 10/20/2025

**Video Generation | Text-To-Video and Image-To-Video support V2.5-turbo**

- Support PRO mode, generate 5-second video with as low as 2.5 units

**General ｜ New Capability: Launching Image Element Recognition API**

- For recognize subjects, faces, clothing, etc., and can receive 4 sets of results per request
- For Multi-Image to Video and Multi-Elements functions

## 10/15/2025

**Video Generation | Video Effects | New Feature**

- Launch of "Single Image Effects": inner_voice, trampoline, guess_what, etc.​​
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

**Avatar | New Feature Launched**

- Generate videos based on images, audio, or text that have natural facial expressions, consistent rhythms, and vocals.
- It's currently not supported to specify faces if there are multiple faces in the input image.

## 09/29/2025

<div class="notice-box">
 ❗️ Notice: To ensure data security, all images and videos generated via our API<span class="notice-box-text-strong">will be automatically purged after 30 days.</span>To avoid any disruption to your service,<span class="notice-box-text-strong">please download and save them locally in a timely manner after generation</span>
</div>

## 09/29/2025

**Video Generation | Video Effects | New Feature**

- Launch of "Single Image Effects": feed_mooncake
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 09/26/2025

**Video Generation | Video Effects | New Feature**

- Launch of "Single Image Effects": rampage_ape, flyer, ​​and dishwasher
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

**TTS | Support speech of 1000 length content**

## 09/15/2025

**Lip-Sync | Feature Update：Support multi person screen lip-sync and start lip-sync time**

- Specify the speaker through face_id and start lip-sync time through sound_insert_time
- Support clipping audio

**TTS | New Feature: Online text-to-speech and enable trial listening function**

- Can generate audio_id simultaneously, can be used for any Kling API

## 09/12/2025

**Video Generation | Video Effects | New Feature**

- Launch of "Single Image Effects": gallery_ring, squeeze_screamt, ​​etc.​​
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 09/05/2025

**Video Generation | New Feature: V2.1 supports start/end frame**

- Supports generating 5s or 10s video, Only supports PRO mode.

**Video Generation | Feature Update: Video-to-Audio**

- Users can input their own sound effect prompts, bgm prompts, and enable ASMR mode.

## 09/01/2025

**Video Generation | Video Effects | New Feature**

- Launch of "Single Image Effects": pet_chinese_opera, muscle_pet, ​​etc.​​
- For video effects details, refer to: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 08/19/2025

**Video Generation | Video Effects | New Feature**

- Supports 62 new single image effects and 1 dual-character effect, expanding the library to 80 callable effects.
- Launched the 'Video Effects Center' page, where users can view effect details and units for API calls: [Video Effects Center](https://kling.ai/document-api/api/effects/templates)

## 08/15/2025

**Video Generation | Feature Update: Video-to-Audio**

- Video-to-Audio feature supports full-resolution video uploads

**Multi-Image to Video | Feature Update: show a 102% performance improvement over the previous feature**

- Subject consistency, dynamics, prompt adherence, style consistency, and visual rendering are better
- No code changes are required

**Image Generation | Model Update: New V2.0 Image-to-Image supports nearly 300 styles**

- Parameter example: "model_name": "kling-v2-new"

## 08/12/2025

**Video Generation | Feature Update: T2V V1.6 supports PRO**

- Supports generating 5s and 10s video
- Parameter example: "mode": "pro"

## 08/01/2025

**Video Generation | New Feature: Text-to-Audio**

- Supports generating audio by text prompts

**Video Generation | New Feature: Video-to-Audio**

- Supports adding audio to all videos generated by Kling models
- Supports adding audio to user-uploaded videos

## 07/30/2025

**Image Generation | Support V2.1 model**

- Update image-to-image kling-v2-1 model

**Multi-Image to Image | Newly launched**

- Support subject reference, scene reference and style reference
- Deduct 16 units from total, about $0.056
- Only support kling-v2-1 model

## 07/21/2025

**Video Generation | Video Effects | New Feature**

- Launch of "Single Image Effects": 7 types available, jelly_press, jelly_slice, jelly_squish, jelly_jiggle, pixelpixel, yearbook, instant_film
- includes create task, query task (single), and query task (list) interfaces

**Multi-Elements | Newly launched**

- Support adding (addition), swapping (swap), and removing (removal) elements to existing videos
- When using, it is necessary to initialize the video and tag it before performing operations such as creating tasks

## 07/07/2025

**Video Generation - Video Effects | New Feature**

- Launch of "Single Image Effects": 2 types available, anime_figure, rocketrocket
- includes create task, query task (single), and query task (list) interfaces

## 06/30/2025

**Lip-Sync | New version new capabilities**

- Supports increasing the maximum video duration from 10 seconds to 60 seconds
- Generating videos takes as little as 2 minutes
- No need to modify the code

## 06/19/2025

**Video Generation | Support V2.1 model**

- Update image2video kling-v2-1 model, supports STD mode and PRO mode
- Update image2video kling-v2-1-master model
- Update text2video kling-v2-1-master model

## 05/13/2025

**Image Generation | Support V2.0 model**

- Support kling-v2 text-to-image

**Video Generation | Support V2.0 Master model**

- Support kling-v2-master text-to-video and image-to-video
- Kling-v2-master currently does not support mode parameter

## 04/25/2025

**Video Generation - Video Effects | New Feature: bloombloom & dizzydizzy (Single Image Effect)**

- Launch of "Single Image Effects": 2 types available, bloombloom, dizzydizzy
- includes create task, query task (single), and query task (list) interfaces

## 03/31/2025

**Video Generation | V1.6 model supports generating videos from end frame**

- V1.6 model PRO mode can be used to generate video footage of the first few seconds of an image based on the image

**Video Generation | V1.5 and V1.6 models support video extension**

- Videos generated based on V1.5 and V1.6 models can be continued for 4-5 seconds after writing
- If the video is generated using "last frame only", continue writing the content of the previous 4-5 seconds

## 03/25/2025

**Image Generation | V1.5 model supports character feature reference and character appearance reference**

- Selecting Face as reference: you can keep the face consistent with the reference image, and use prompt to change other components like the outfit and the background; great for single-character consistency across different looks
- Selecting Subject as reference: you can set the entire subject as reference, and even fine-tune the reference level on the face and the subject; great for keeping the appearance of the character consistent across different scenes

## 03/18/2025

**Video Generation - Video Effects | New Feature: fuzzyfuzzy（Single Image Effect）**

- Launch of "Single Image Effects": fuzzyfuzzy
- Includes create task, query task (single), and query task (list) interfaces

## 03/12/2025

**Video Generation - Video Effects | New Feature: Single Image Effect**

- Launch of "Single Image Effects": 2 types available, squish, expansion
- Includes create task, query task (single), and query task (list) interfaces

**Video Generation | New models supports start/end frame, end frame, motion brush, camera control**

- V1.5 Model PRO mode supports start/end frame, end frame, motion brush, camera control(simple only)
- V1.6 Model PRO mode supports start/end frame

**Video Generation | Lip-syncing supports customized videos and more available tones**

- Supports lip-syncing for any 1080p or 720p video within 10s
- Added 8 new Chinese and English tones that can be used directly to dub lip-sync videos

**Image Generation | Support V1.5 models**

- Improved aesthetics: better composition and lighting, especially more aesthetically pleasing in portraits
- Improved image quality: enhanced fidelity in details, more natural rendering, and stronger tonal contrast
- Support 21:9 aspect ratio

## 03/05/2025

**Video Generation | New Feature: Creative Video Effects**

- Launch of "Dual-Image Effects": 3 types available, "hug", "kiss", and "heart_gesture".
- Includes create task, query task (single), and query task (list) interfaces

> Compared to the general video generation API, the video effects API provides more flexible calling parameters and integrates pre- and post-processing functionalities tailored for video effects (e.g., dual-image effects). For example, it allows users to input two portrait images, automatically stitches them into a single composite image, and generates the video using the stitched image. This makes the API more flexible and efficient.

## 02/14/2025

**Image Generation | The "model" field has been changed to "model_name"**

> Please note that in order to maintain naming consistency, the original model field has been changed to model_name, so in the future, please use this field to specify the version of the model that needs to be called.=
> - At the same time, we keep the behavior forward-compatible, if you continue to use the original model field, it will not have any impact on the interface call, there will not be any exception, which is equivalent to the default behavior when model_name is empty (i.e., call the V1 model).

## 01/07/2025

**Video Generation | V1.6 Model Officially Launched**

- Supports text-to-video STD mode, image-to-video STD mode, and image-to-video PRO mode
- Currently does not support tail frame, motion brushes, camera control, and other control features

> Please note that in order to maintain naming consistency, the original model field has been changed to model_name, so in the future, please use this field to specify the version of the model that needs to be called.
> - At the same time, we keep the behavior forward-compatible, if you continue to use the original model field, it will not have any impact on the interface call, there will not be any exception, which is equivalent to the default behavior when model_name is empty (i.e., call the V1 model).

## 12/30/2024

**Virtual Try-On | New V1.5 model**

- V1.5 model is a comprehensive upgrade of V1.0 model
- V1.5 model supports single clothing (upper, lower, and dress dress) try-on, as well as "upper + lower" combination try-on

## 12/23/2024

**Video Generation | New Feature: Lip-Sync**

- Videos generated by the Video V1.0 model and Video V1.5 model support lip-sync as long as the video meets the facial requirements
- Includes create task, query task (single), and query task (list) interfaces

## 12/09/2024

**Video Generation | Video V1.5 Std Model Now Open for Video Generation: Image-to-Video Functionality Enabled, Text-to-Video Unsupported**

- Supports standard mode
- Tail frame control is not supported
- All other parameters are supported

> Please note that in order to maintain naming consistency, the original model field has been changed to model_name, so in the future, please use this field to specify the version of the model that needs to be called.
> - At the same time, we keep the behavior forward-compatible, if you continue to use the original model field, it will not have any impact on the interface call, there will not be any exception, which is equivalent to the default behavior when model_name is empty (i.e., call the V1 model).

## 12/02/2024

**Video Generation | Capability Map**

- With multiple versions of the video generation model (V1, V1.5) and various plugin capabilities (e.g., camera control, start/end frame, motion brush, video extension, etc.), we have created a **"Capability Map"** to make it easier for everyone to visually check the availability of different versions and features. For details, please refer to the "3-0 Capability Map."

## 11/29/2024

**Video Generation - ImageToVideo | New Feature: Motion Brush**

- This feature is only supported in Standard Mode 5s and Professional Mode 5s for the V1.0 model, and is currently not available for the V1.5 model.

## 11/15/2024

**Video Generation | Video V1.5 Pro Model Now Open for Video Generation: Image-to-Video Functionality Enabled, Text-to-Video Unsupported**

- Only supports professional mode
- Tail frame control is not supported
- All other parameters are supported

**Video Generation | New Feature: Video Extension**

- Supports extending videos generated by the V1.0 model directly, adding 4-5 seconds of video length per extension
- Includes create task, query task (single), and query task (list) interfaces

**Video Generation | Other Updates**

- Added "external_task_id" field, allowing you to customize a task ID when creating a task, and query the video using this custom ID when needed

> Please note that in order to maintain naming consistency, the original model field has been changed to model_name, so in the future, please use this field to specify the version of the model that needs to be called.
> - At the same time, we keep the behavior forward-compatible, if you continue to use the original model field, it will not have any impact on the interface call, there will not be any exception, which is equivalent to the default behavior when model_name is empty (i.e., call the V1 model).

## 10/30/2024

Added the "Query Resource Package List and Remaining Quantity" interface for your convenience. See "Section VI: Account Information Query".

## 10/25/2024

To ensure information security, **generated images/videos will be cleared after 30 days**. Please make sure to save them promptly.

## 10/15/2024

Add a sample **Java** code for generating the API_Token.

## 09/19/2024

Video Generation
When creating a task, the character limit for the **prompt** and **negative_prompt** in the request parameters has been updated to: cannot exceed 2500 characters.

## 09/19/2024

Officially supporting the "**AI Virtual Try-on**" related API (**kolors-virtual-try-on**).
