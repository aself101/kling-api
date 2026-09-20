> ## Documentation Index
>
> Fetch the complete documentation index at: https://kling.ai/document-api/llms.txt
> Use this file to discover all available pages before exploring further.

# Video Effects

> Source: https://kling.ai/document-api/api/effects/video-effects
> Locale: en
> Current Tab: Video Effects
> This content is optimized for LLMs. In-page tabs are expanded and UI-only controls are omitted.

---

## Create Task

### API Overview

- Method: `POST`
- Path: `/v1/videos/effects`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Description

Total of 219 video effects are available. You can achieve different effects by calling effect_scene. For detailed list, please refer to: [Video Effects Center](https://kling.ai/document-api/quickStart/productIntroduction/effectsCenter)

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data Exchange Format |
| `Authorization` | string | Yes | - | - | Authentication information, refer to API authentication |

### Request Body

| Field Path | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `effect_scene` | string | Yes | - | `net_the_fish`, `birthday_board`, `summer_fireworks`, `blow_blaze`, `champagne_birthday`, `pet_working_daily`, `pet_roll_window`, `pet_crash_earth`, `makeup_style`, `hair_dressup`, `barbie_transform`, `critter_paste`, `wiggle_faces_pets`, `paw_headbang`, `food_splash`, `dj_pet`, `pet_diving`, `disco_paws`, `pet_fitness`, `j_var_live`, `pet_burst`, `idol_live`, `beast_striker`, `african_sway`, `jealousy_sway`, `chubby_fish`, `shrug_dance`, `soccer_star`, `bra_hot_dance`, `arg_hot_dance`, `fra_hot_dance`, `bra_goal`, `arg_goal`, `por_goal`, `victory_slide`, `samba_fever`, `bicycle_kick`, `football_dance_2`, `red_card_sent_off`, `football_dance`, `magic_world_vlog`, `magic_world_vlog_9_16`, `air_dunk`, `whirling_beverage_9_16`, `tennis_trend`, `tennis_trend_9_16`, `football_live_9_16`, `whirling_beverage`, `f1_live`, `football_live`, `spielberg_transition`, `korean_baseball_9_16`, `korean_baseball`, `pet_skateboard`, `daily_ootd`, `tiny_beast_printer`, `landmark_reveal`, `winter_charm`, `flash_ride`, `maestro_of_magic`, `magic_carpet_ride`, `good_luck_spirit`, `shooting_star`, `sparkler_wand`, `sovereign_scepter`, `dirt_rush`, `return_of_the_king`, `dance_with_dragon`, `minimalist_light`, `martial_meow`, `sassy_shake`, `knock_at_a_door_revenge`, `palm_sized_figure_pro`, `prank_box`, `perler_beads`, `spring_bloom`, `toss_run`, `switch_to_silk`, `get_rich_quick`, `make_it_rain`, `twist_shake`, `the_hip_sway`, `send_my_love`, `funky_martian`, `wealth_drive`, `the_high_kick`, `the_exercise`, `lucky_veggie`, `studio_look`, `flash_drive`, `shush_my_dreams`, `french_elegance`, `finger_swipe`, `advent_of_flora`, `smooth_transition`, `kiss_pro`, `raid_check`, `snow_night_kiss`, `eternal_kiss`, `fortune_in_motion`, `chinese_trend`, `sedan_chair_dance`, `skyfall`, `good_luck_dance`, `laicai_dance`, `yangge_dance`, `color_mixing`, `lantern_festival_cuju`, `unique_firework`, `unique_spring_couplets`, `horse_mask`, `fortune_knocks_cartoon`, `tangyuan_to_animal`, `hot_feet_dance`, `swag_dance`, `pigeon_dance`, `bloodline_dance`, `chanel_dance`, `cute_dance`, `love_theme_song`, `pumpitup_dance`, `city_to_village`, `fortune_god_transform`, `new_year_feast`, `ring_in_new`, `horse_year_firework`, `crystal_horse`, `drunk_dance`, `drunk_dance_pet`, `daoma_dance`, `bouncy_dance`, `smooth_sailing_dance`, `new_year_greeting`, `lion_dance`, `prosperity`, `great_success`, `golden_horse_fortune`, `red_packet_box`, `lucky_horse_year`, `lucky_red_packet`, `lucky_money_come`, `lion_dance_pet`, `dumpling_making_pet`, `fish_making_pet`, `pet_red_packet`, `lantern_glow`, `expression_challenge`, `overdrive`, `heart_gesture_dance`, `poping`, `martial_arts`, `running`, `nezha`, `motorcycle_dance`, `subject_3_dance`, `ghost_step_dance`, `phantom_jewel`, `zoom_out`, `cheers_2026`, `fight_pro`, `hug_pro`, `heart_gesture_pro`, `dollar_rain_pro`, `pet_bee_pro`, `countdown_teleport`, `santa_random_surprise`, `magic_match_tree`, `bullet_time_360`, `happy_birthday`, `birthday_star`, `thumbs_up_pro`, `tiger_hug_pro`, `pet_lion_pro`, `surprise_bouquet`, `bouquet_drop`, `glamour_photo_shoot`, `box_of_joy`, `first_toast_of_the_year`, `my_santa_pic`, `santa_gift`, `steampunk_christmas`, `snowglobe`, `christmas_photo_shoot`, `ornament_crash`, `santa_express`, `instant_christmas`, `coronation_of_frost`, `building_sweater`, `spark_in_the_snow`, `scarlet_and_snow`, `bullet_time_lite`, `jumping_ginger_joy`, `pure_white_wings`, `black_wings`, `golden_wing`, `pink_pink_wings`, `venomous_spider`, `throne_of_king`, `luminous_elf`, `woodland_elf`, `guardian_spirit`, `swish_swish`, `snowboarding`, `witch_transform`, `vampire_transform`, `pumpkin_head_transform`, `demon_transform`, `mummy_transform`, `zombie_transform`, `cute_pumpkin_transform`, `halloween_escape`, `pet_moto_rider`, `running_man`, `3d_cartoon_2`, `pet_dance`, `swing_swing`, `day_to_night`, `surfsurf`, `skateskate` | Scene Name |
| `input` | object | Yes | - | - | Task input structure. Fields vary depending on the scene. |
| `input.image` | string | No | - | - | Reference Image (for single-image effects) |
| `input.images` | array | No | - | - | Reference Image Group (for dual-image effects) |
| `callback_url` | string | No | - | - | The callback notification address for the result of this task. If configured, the server will actively notify when the task status changes. |
| `external_task_id` | string | No | - | - | Customized Task ID |

#### Request Body Field Notes

- `effect_scene`: For more parameters, please refer to [Video Effects Center](https://kling.ai/document-api/api/effects/templates)
- `input`: **Single-image effects (204 types available)** Scenes include: net_the_fish, birthday_board, summer_fireworks, blow_blaze, champagne_birthday, pet_working_daily, pet_roll_window, pet_crash_earth, makeup_style, hair_dressup, barbie_transform, critter_paste, wiggle_faces_pets, paw_headbang, food_splash, dj_pet, pet_diving, disco_paws, pet_fitness, j_var_live, pet_burst, idol_live, beast_striker, african_sway, jealousy_sway, chubby_fish, shrug_dance, soccer_star, bra_hot_dance, arg_hot_dance, fra_hot_dance, bra_goal, arg_goal, por_goal, victory_slide, samba_fever, bicycle_kick, football_dance_2, red_card_sent_off, football_dance, magic_world_vlog, magic_world_vlog_9_16, air_dunk, whirling_beverage_9_16, tennis_trend, tennis_trend_9_16, football_live_9_16, whirling_beverage, f1_live, football_live, spielberg_transition, korean_baseball_9_16, korean_baseball, tiny_beast_printer, landmark_reveal, winter_charm, flash_ride, maestro_of_magic, magic_carpet_ride, good_luck_spirit, shooting_star, sparkler_wand, sovereign_scepter, dirt_rush, return_of_the_king, dance_with_dragon, minimalist_light, martial_meow, sassy_shake, knock_at_a_door_revenge, palm_sized_figure_pro, prank_box, perler_beads, spring_bloom, get_rich_quick, make_it_rain, twist_shake, the_hip_sway, send_my_love, funky_martian, wealth_drive, the_high_kick, the_exercise, lucky_veggie, flash_drive, shush_my_dreams, advent_of_flora, raid_check, fortune_in_motion, chinese_trend, sedan_chair_dance, skyfall, good_luck_dance, laicai_dance, yangge_dance, color_mixing, lantern_festival_cuju, unique_firework, unique_spring_couplets, horse_mask, fortune_knocks_cartoon, tangyuan_to_animal, hot_feet_dance, swag_dance, pigeon_dance, bloodline_dance, chanel_dance, cute_dance, love_theme_song, pumpitup_dance, city_to_village, fortune_god_transform, new_year_feast, ring_in_new, horse_year_firework, crystal_horse, drunk_dance, drunk_dance_pet, daoma_dance, bouncy_dance, smooth_sailing_dance, new_year_greeting, lion_dance, prosperity, great_success, golden_horse_fortune, red_packet_box, lucky_horse_year, lucky_red_packet, lucky_money_come, lion_dance_pet, dumpling_making_pet, fish_making_pet, pet_red_packet, lantern_glow, expression_challenge, overdrive, heart_gesture_dance, poping, martial_arts, running, nezha, motorcycle_dance, subject_3_dance, ghost_step_dance, phantom_jewel, zoom_out, dollar_rain_pro, pet_bee_pro, countdown_teleport, santa_random_surprise, magic_match_tree, bullet_time_360, happy_birthday, birthday_star, thumbs_up_pro, tiger_hug_pro, pet_lion_pro, surprise_bouquet, bouquet_drop, glamour_photo_shoot, box_of_joy, first_toast_of_the_year, my_santa_pic, santa_gift, steampunk_christmas, snowglobe, christmas_photo_shoot, ornament_crash, santa_express, instant_christmas, coronation_of_frost, building_sweater, spark_in_the_snow, scarlet_and_snow, bullet_time_lite, jumping_ginger_joy, pure_white_wings, black_wings, golden_wing, pink_pink_wings, venomous_spider, throne_of_king, luminous_elf, woodland_elf, guardian_spirit, swish_swish, snowboarding, witch_transform, vampire_transform, pumpkin_head_transform, demon_transform, mummy_transform, zombie_transform, cute_pumpkin_transform, halloween_escape, pet_moto_rider, running_man, 3d_cartoon_2, pet_dance, swing_swing, day_to_night, surfsurf, skateskate
- `input`: **Dual-Image effects (15 types available)** Scenes include: pet_skateboard, daily_ootd, toss_run, switch_to_silk, studio_look, french_elegance, finger_swipe,  smooth_transition, kiss_pro, snow_night_kiss, eternal_kiss, cheers_2026, fight_pro, hug_pro, heart_gesture_pro
- `input.image`: Supports image Base64 encoding or image URL (ensure accessibility)
- `input.image`: Important: When using Base64, do NOT add any prefix like `data:image/png;base64,`. Submit only the raw Base64 string.
- `input.image`: Correct Base64 format:
  ```plaintext
  iVBORw0KGgoAAAANSUhEUgAAAAUA...
  ```
- `input.image`: Incorrect Base64 format (with data: prefix):
  ```plaintext
  data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...
  ```
- `input.image`: Supported image formats: .jpg / .jpeg / .png
- `input.image`: File size: ≤10MB, dimensions: ≥300px, aspect ratio: 1:2.5 ~ 2.5:1
- `input.images`: Array length must be 2. The first image uploaded will be positioned on the left side of the composite photo, and the second image uploaded will be positioned on the right side.
- `input.images`: This service includes composite photo functionality. Users upload two portrait images, and Kling AI will adaptively stitch them into a composite photo.
  ![Composite Photo](https://p4-kling.klingai.com/kcdn/cdn-kcdn112452/kling-api-document/video-effects-group-photo.jpeg)
- `input.images`: Supports image Base64 encoding or image URL (ensure accessibility)
- `input.images`: Important: When using Base64, do NOT add any prefix like `data:image/png;base64,`. Submit only the raw Base64 string.
- `input.images`: Correct Base64 format:
  ```plaintext
  iVBORw0KGgoAAAANSUhEUgAAAAUA...
  ```
- `input.images`: Incorrect Base64 format (with data: prefix):
  ```plaintext
  data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...
  ```
- `input.images`: Supported image formats: .jpg / .jpeg / .png
- `input.images`: File size: ≤10MB, dimensions: ≥300px, aspect ratio: 1:2.5 ~ 2.5:1
- `callback_url`: For specific message schema, see [Callback Protocol](https://kling.ai/document-api/api/get-started/callbacks)
- `external_task_id`: User-defined task ID. It will not override the system-generated task ID, but supports querying tasks by this ID
- `external_task_id`: Please note that it must be unique for each user

### Request Example

```bash
curl --request POST \
  --url https://api-singapore.klingai.com/v1/videos/effects \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "effect_scene": "color_mixing",
    "input": {
      "image": "https://p4-kling.klingai.com/kcdn/cdn-kcdn112452/kling-op/effects_raw_pic/color_mixing.jpeg"
    }
  }'
```

### Response Example

```json
{
  "code": 0, //Error codes；Specific definitions can be found in "Error Code"
  "message": "string", //Error information
  "request_id": "string", //Request ID, generated by the system
  "data":{
    "task_id": "string", //Task ID, generated by the system
    "task_status": "string", //Task status, Enum values：submitted、processing、succeed、failed
    "task_info":{ //Task creation parameters
        "external_task_id": "string" //Customer-defined task ID
    },
    "created_at": 1722769557708, //Task creation time, Unix timestamp, unit ms
    "updated_at": 1722769557708 //Task update time, Unix timestamp, unit ms
  }
}
```

---

### Single-Image Effect Request Example

```json
{
    "effect_scene": "pet_lion_pro",
    "input": {
        "image": "https://p4-kling.klingai.com/bs2/upload-ylab-stunt/c54e463c95816d959602f1f2541c62b2.png?x-kcdn-pid=112452"
    }
}
```

### Dual-Character Effect Request Example

```json
{
    "effect_scene": "hug_pro",
    "input": {
        "images": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
    }
}
```

---

## Query Task (Single)

### API Overview

- Method: `GET`
- Path: `/v1/videos/effects/{id}`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data Exchange Format |
| `Authorization` | string | Yes | - | - | Authentication information, refer to API authentication |

### Path Params

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `task_id` | string | No | - | - | Task ID for Video Effects |
| `external_task_id` | string | No | - | - | Customized Task ID for Video Effects |

#### Path Params Field Notes

- `task_id`: Request path parameter, fill value directly in request path
- `task_id`: Two query methods available: task_id or external_task_id (choose one)
- `external_task_id`: The external_task_id filled when creating the task
- `external_task_id`: Two query methods available: task_id or external_task_id (choose one)

### Request Example

```bash
curl --request GET \
  --url https://api-singapore.klingai.com/v1/videos/effects/{task_id} \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json'
```

### Response Example

```json
{
  "code": 0, // Error codes; Specific definitions can be found in Error codes
  "message": "string", // Error information
  "request_id": "string", // Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data": {
    "task_id": "string", // Task ID, generated by the system
    "task_status": "string", // Task status, Enum values: submitted, processing, succeed, failed
    "task_status_msg": "string", // Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
    "task_info": { //Task creation parameters
      "external_task_id": "string" //Customer-defined task ID
    },
    "task_result": {
      "videos": [
        {
          "id": "string", // Generated video ID; globally unique
          "url": "string", // URL for generating videos, such as https://p1.a.kwimgs.com/bs2/upload-ylab-stunt/special-effect/output/HB1_PROD_ai_web_46554461/-2878350957757294165/output.mp4 (To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
          "watermark_url": "string", // Watermarked video download URL, anti-leech format
        }
      ]
    },
    "watermark_info": {
      "enabled": boolean
    },
    "final_unit_deduction": "string", // The deduction units of task
    "final_balance_deduction": { // Balance deduction information
      "quota": "string", // Balance deduction discount price
      "list_price": "string" // Balance deduction list price
    },
    "created_at": 1722769557708, // Task creation time, Unix timestamp, unit: ms
    "updated_at": 1722769557708 //Task update time, Unix timestamp, unit: ms
  }
}
```

---

## Query Task (List)

### API Overview

- Method: `GET`
- Path: `/v1/videos/effects`
- Auth: `Authorization: Bearer <API_KEY>`
- Content-Type: `application/json`

### Headers

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `Content-Type` | string | Yes | `application/json` | - | Data Exchange Format |
| `Authorization` | string | Yes | - | - | Authentication information, refer to API authentication |

### Query Params

| Field | Type | Required | Default | Enum | Description |
|---|---|---:|---|---|---|
| `pageNum` | int | No | `1` | - | Page number |
| `pageSize` | int | No | `30` | - | Number of items per page |

#### Query Params Field Notes

- `pageNum`: Value range: [1, 1000]
- `pageSize`: Value range: [1, 500]

### Request Example

```bash
curl --request GET \
  --url 'https://api-singapore.klingai.com/v1/videos/effects?pageNum=1&pageSize=30' \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json'
```

### Response Example

```json
{
  "code": 0, // Error codes; Specific definitions can be found in Error codes
  "message": "string", // Error information
  "request_id": "string", // Request ID, generated by the system, is used to track requests and troubleshoot problems
  "data": [
    {
      "task_id": "string", // Task ID, generated by the system
      "task_status": "string", // Task status, Enum values: submitted, processing, succeed, failed
      "task_status_msg": "string", // Task status information, displaying the failure reason when the task fails (such as triggering the content risk control of the platform, etc.)
      "task_info": { //Task creation parameters
        "external_task_id": "string" //Customer-defined task ID
      },
      "task_result": {
        "videos": [
          {
            "id": "string", // Generated video ID; globally unique
            "url": "string", // URL for generating videos, such as https://p1.a.kwimgs.com/bs2/upload-ylab-stunt/special-effect/output/HB1_PROD_ai_web_46554461/-2878350957757294165/output.mp4 (To ensure information security, generated images/videos will be cleared after 30 days. Please make sure to save them promptly.)
            "watermark_url": "string", // Watermarked video download URL, anti-leech format
          }
        ]
      },
      "final_unit_deduction": "string", // The deduction units of task
      "final_balance_deduction": { // Balance deduction information
        "quota": "string", // Balance deduction discount price
        "list_price": "string" // Balance deduction list price
      },
      "created_at": 1722769557708, // Task creation time, Unix timestamp, unit: ms
      "updated_at": 1722769557708 //Task update time, Unix timestamp, unit: ms
    }
  ]
}
```
