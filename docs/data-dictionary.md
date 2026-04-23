# Orison Space — 数据字典

## 0. PostgreSQL — users 表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PK, DEFAULT gen_random_uuid() | 用户唯一标识 |
| email | VARCHAR(255) | UNIQUE NOT NULL | 登录邮箱 |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt 哈希密码 |
| display_name | VARCHAR(100) | — | 显示名称 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 注册时间 |

数据库：`orison_dev`，连接串：`postgresql://root:root@localhost:5432/orison_dev`

---

## 1. 总览

项目数据采用 **YAML + Markdown** 混合存储：

- 结构化字段（元信息、大纲、章节索引、分镜参数等）存储在 `project.yaml`
- 实际内容（章节正文、场景正文）存储为独立的 `.md` 文件，通过 `content_file` 字段引用

### 项目目录结构

```
my-project/
├── project.yaml            # 项目结构化数据
├── chapters/               # 小说章节正文（type=novel）
│   ├── ch-001.md
│   └── ch-002.md
├── scenes/                 # 剧本场景正文（type=script）
│   ├── sc-001.md
│   └── sc-002.md
└── assets/                 # 素材文件（图片、音频等）
```

### 模块关系

```
ProjectDocument
├── meta                          # 项目元信息
├── outline                       # 大纲（高层结构）
│   ├── logline, style
│   └── acts[]                    # 幕
│       └── beats[]               # 节拍点
├── detailed_outline              # 细纲（幕级展开）
│   └── act_details[]
│       └── scene_briefs[]        # 场景/章节摘要
├── novel (type=novel)            # 小说模块
│   └── chapters[]                # 章节 → content_file 指向 md
├── script (type=script)          # 剧本模块
│   └── scenes[]                  # 场景 → content_file 指向 md
│       └── dialogues[]           # 对白
├── storyboard                    # 分镜（独立模块）
│   └── shots[]                   # 镜头 → source_ref 引用章节/场景
├── video                         # 视频
│   └── clips[]                   # 片段 → shot_id 引用镜头
└── assets                        # 素材
    ├── characters[]              # 角色
    └── locations[]               # 场景地点
```

---

## 2. meta — 项目元信息

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 项目唯一标识，UUID |
| name | string | 是 | 项目名称 |
| type | enum | 是 | 项目类型：`novel`（小说）或 `script`（剧本） |
| version | integer | 是 | 数据版本号，每次保存递增 |
| created_at | string | 是 | 创建时间，ISO 8601 |
| updated_at | string | 是 | 最后修改时间，ISO 8601 |

---

## 3. outline — 大纲

项目级高层结构，描述故事的核心设定和幕级划分。

### 3.1 outline 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 作品标题 |
| logline | string | 否 | 一句话概述（Logline） |
| genre | string | 否 | 类型（科幻、悬疑、爱情等） |
| theme | string | 否 | 主题 |
| style | object | 否 | 风格设定，见下表 |
| acts | array\<Act\> | 是 | 幕列表 |

### 3.2 outline.style — 风格设定

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| visual_style | string | 否 | 视觉风格（写实、动画、赛博朋克等） |
| narrative_style | string | 否 | 叙事风格（线性、非线性、多视角等） |
| pacing | string | 否 | 节奏（快节奏、慢热、张弛有度等） |
| reference | string | 否 | 参考作品或风格说明 |

### 3.3 outline.acts[] — 幕

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 幕 ID |
| title | string | 是 | 幕标题 |
| summary | string | 否 | 幕概要 |
| conflict_level | integer | 否 | 冲突等级（1-10） |
| pacing | integer | 否 | 节奏等级（1-10） |
| beats | array\<Beat\> | 否 | 节拍点列表 |

### 3.4 outline.acts[].beats[] — 节拍点

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 节拍 ID |
| description | string | 是 | 节拍描述 |
| type | enum | 否 | 节拍类型：`setup` / `confrontation` / `resolution` / `twist` / `climax` |

---

## 4. detailed_outline — 细纲

大纲的细化展开，按幕拆分为具体的场景/章节摘要，作为正式写作前的规划。

### 4.1 detailed_outline 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| act_details | array\<ActDetail\> | 是 | 按幕展开的细纲列表 |

### 4.2 detailed_outline.act_details[] — 幕细纲

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| act_id | string | 是 | 关联的幕 ID（引用 outline.acts[].id） |
| scene_briefs | array\<SceneBrief\> | 是 | 场景/章节摘要列表 |

### 4.3 detailed_outline.act_details[].scene_briefs[] — 场景摘要

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 摘要 ID |
| title | string | 是 | 场景/章节标题 |
| summary | string | 是 | 内容摘要 |
| characters | array\<string\> | 否 | 涉及角色 ID 列表 |
| location_id | string | 否 | 场景地点 ID（引用 assets.locations[].id） |
| notes | string | 否 | 备注 |

---

## 5. novel — 小说模块

仅当 `meta.type = "novel"` 时存在。

### 5.1 novel 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| chapters | array\<Chapter\> | 是 | 章节列表 |

### 5.2 novel.chapters[] — 章节

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 章节 ID |
| title | string | 是 | 章节标题 |
| sort_order | integer | 是 | 排序序号 |
| act_id | string | 否 | 所属幕 ID（引用 outline.acts[].id） |
| summary | string | 否 | 章节摘要 |
| content_file | string | 是 | 正文文件路径，如 `chapters/ch-001.md` |
| word_count | integer | 否 | 字数统计（由系统维护） |
| status | enum | 否 | 状态：`draft` / `revised` / `final` |

---

## 6. script — 剧本模块

仅当 `meta.type = "script"` 时存在。

### 6.1 script 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| scenes | array\<Scene\> | 是 | 场景列表 |

### 6.2 script.scenes[] — 场景

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 场景 ID |
| title | string | 是 | 场景标题 |
| sort_order | integer | 是 | 排序序号 |
| act_id | string | 否 | 所属幕 ID（引用 outline.acts[].id） |
| summary | string | 否 | 场景摘要 |
| content_file | string | 是 | 正文文件路径，如 `scenes/sc-001.md` |
| location_id | string | 否 | 场景地点 ID（引用 assets.locations[].id） |
| time_of_day | string | 否 | 时间段（日/夜/黄昏等） |
| status | enum | 否 | 状态：`draft` / `revised` / `final` |
| dialogues | array\<Dialogue\> | 否 | 对白列表（结构化存储，与 content_file 互补） |

### 6.3 script.scenes[].dialogues[] — 对白

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 对白 ID |
| character_id | string | 是 | 角色 ID（引用 assets.characters[].id） |
| line | string | 是 | 台词内容 |
| direction | string | 否 | 表演指示（低语、怒吼等） |
| emotion | string | 否 | 情绪标注 |

---

## 7. storyboard — 分镜模块

独立模块，通过 `source_ref` 引用章节或场景。

### 7.1 storyboard 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shots | array\<Shot\> | 是 | 镜头列表 |

### 7.2 storyboard.shots[] — 镜头

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 镜头 ID |
| sort_order | integer | 是 | 排序序号 |
| source_ref | object | 否 | 来源引用，见下表 |
| description | string | 是 | 镜头描述 |
| image_prompt | string | 否 | AI 生图提示词 |
| image_url | string | 否 | 已生成的图片路径 |
| duration | number | 否 | 时长（秒） |
| camera_lens | enum | 否 | 镜头焦距：`macro` / `portrait` / `wide` / `ultra_wide` |
| camera_movement | string | 否 | 运镜方式（推/拉/摇/移等） |
| aspect_ratio | enum | 否 | 画面比例：`16:9` / `2.35:1` / `4:3` |
| lighting_mood | enum | 否 | 光影氛围：`natural` / `golden_hour` / `noir` / `cinematic_blue` |

### 7.3 storyboard.shots[].source_ref — 来源引用

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| module | enum | 是 | 来源模块：`novel` 或 `script` |
| entity_id | string | 是 | 引用的章节 ID 或场景 ID |

---

## 8. video — 视频模块

### 8.1 video 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| clips | array\<Clip\> | 是 | 片段列表 |

### 8.2 video.clips[] — 片段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 片段 ID |
| shot_id | string | 是 | 关联镜头 ID（引用 storyboard.shots[].id） |
| sort_order | integer | 是 | 排序序号 |
| start_time | number | 是 | 起始时间（秒） |
| end_time | number | 是 | 结束时间（秒） |
| video_url | string | 否 | 已生成的视频文件路径 |
| status | enum | 否 | 状态：`pending` / `generating` / `completed` / `failed` |

---

## 9. assets — 素材

### 9.1 assets.characters[] — 角色

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 角色 ID |
| name | string | 是 | 角色名称 |
| appearance | string | 否 | 外观描述 |
| personality | string | 否 | 性格描述 |
| reference_image | string | 否 | 参考图片路径 |

### 9.2 assets.locations[] — 场景地点

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 地点 ID |
| name | string | 是 | 地点名称 |
| description | string | 否 | 环境描述 |
| reference_image | string | 否 | 参考图片路径 |

---

## 10. 引用关系汇总

| 来源字段 | 目标 | 说明 |
|----------|------|------|
| novel.chapters[].act_id | outline.acts[].id | 章节所属幕 |
| script.scenes[].act_id | outline.acts[].id | 场景所属幕 |
| script.scenes[].location_id | assets.locations[].id | 场景地点 |
| script.scenes[].dialogues[].character_id | assets.characters[].id | 对白角色 |
| detailed_outline.act_details[].act_id | outline.acts[].id | 细纲对应幕 |
| detailed_outline.act_details[].scene_briefs[].location_id | assets.locations[].id | 摘要地点 |
| detailed_outline.act_details[].scene_briefs[].characters[] | assets.characters[].id | 摘要涉及角色 |
| storyboard.shots[].source_ref.entity_id | novel.chapters[].id 或 script.scenes[].id | 镜头来源 |
| video.clips[].shot_id | storyboard.shots[].id | 片段对应镜头 |

---

## 11. YAML 示例

```yaml
meta:
  id: "proj_abc123"
  name: "星际迷途"
  type: "script"
  version: 3
  created_at: "2026-04-20T10:00:00Z"
  updated_at: "2026-04-23T14:30:00Z"

outline:
  title: "星际迷途"
  logline: "一名宇航员在深空任务中失联，必须独自找到回家的路"
  genre: "科幻"
  theme: "孤独与希望"
  style:
    visual_style: "写实"
    narrative_style: "线性"
    pacing: "张弛有度"
    reference: "《地心引力》《火星救援》"
  acts:
    - id: "act-001"
      title: "第一幕：失联"
      summary: "飞船遭遇陨石雨，通讯中断，主角与地球失去联系"
      conflict_level: 7
      pacing: 8
      beats:
        - id: "beat-001"
          description: "日常巡检，一切正常"
          type: "setup"
        - id: "beat-002"
          description: "陨石雨突袭，飞船受损"
          type: "confrontation"

detailed_outline:
  act_details:
    - act_id: "act-001"
      scene_briefs:
        - id: "sb-001"
          title: "晨间巡检"
          summary: "主角在飞船内进行例行检查，通过通讯与地面闲聊"
          characters: ["char-001"]
          location_id: "loc-001"
        - id: "sb-002"
          title: "陨石来袭"
          summary: "警报响起，主角紧急应对，通讯天线被击毁"
          characters: ["char-001"]
          location_id: "loc-001"

script:
  scenes:
    - id: "sc-001"
      title: "晨间巡检"
      sort_order: 1
      act_id: "act-001"
      summary: "主角在飞船内进行例行检查"
      content_file: "scenes/sc-001.md"
      location_id: "loc-001"
      time_of_day: "日"
      status: "draft"
      dialogues:
        - id: "dlg-001"
          character_id: "char-001"
          line: "地面，这里是远征号，晨间巡检一切正常。"
          direction: "平静"
          emotion: "轻松"

storyboard:
  shots:
    - id: "shot-001"
      sort_order: 1
      source_ref:
        module: "script"
        entity_id: "sc-001"
      description: "飞船内部全景，主角漂浮在零重力中检查仪表"
      image_prompt: "interior of a spacecraft, astronaut floating in zero gravity checking instruments, realistic lighting"
      duration: 5
      camera_lens: "wide"
      camera_movement: "缓慢推进"
      aspect_ratio: "2.35:1"
      lighting_mood: "natural"

video:
  clips:
    - id: "clip-001"
      shot_id: "shot-001"
      sort_order: 1
      start_time: 0
      end_time: 5
      status: "pending"

assets:
  characters:
    - id: "char-001"
      name: "陈远"
      appearance: "35岁，短发，瘦削，穿白色宇航服"
      personality: "沉稳、理性，但内心孤独"
  locations:
    - id: "loc-001"
      name: "远征号飞船内部"
      description: "紧凑的飞船舱室，仪表密布，窗外是深邃的星空"
```
