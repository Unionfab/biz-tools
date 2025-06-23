#!/bin/bash

# 用法: ./ma_batch_watermark.sh <视频目录> <随机码数量>

set -e

if [ $# -ne 2 ]; then
    echo "用法: $0 <视频目录> <随机码数量>"
    exit 1
fi

VIDEO_DIR="$1"
CODE_NUM="$2"

# 检查 ffmpeg
if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "请先安装 ffmpeg"
    exit 1
fi

# 字体路径（如有需要请修改）
FONT_PATH="/System/Library/Fonts/PingFang.ttc"
if [ ! -f "$FONT_PATH" ]; then
    echo "未找到字体文件: $FONT_PATH，请修改脚本中的 FONT_PATH 路径"
    exit 1
fi

# 支持的视频格式
VIDEO_EXTS="mp4 mov mkv avi"

# 生成随机码函数（8位大写字母+数字）
gen_code() {
    local code=""
    while [ ${#code} -lt 8 ]; do
        code=$(LC_CTYPE=C tr -dc 'A-Z0-9' </dev/urandom | head -c8)
    done
    echo "$code"
}

# 生成随机码列表
CODES=()
for ((i = 0; i < $CODE_NUM; i++)); do
    CODES+=("$(gen_code)")
done

echo "生成的随机码: ${CODES[*]}"

# 遍历每个随机码
echo "开始批量加水印..."
for CODE_IDX in "${!CODES[@]}"; do
    CODE="${CODES[$CODE_IDX]}"
    DIR_IDX=$(printf "%02d" $((CODE_IDX + 1)))
    OUT_DIR="${VIDEO_DIR}/${DIR_IDX}_output_${CODE}"
    mkdir -p "$OUT_DIR"
    echo "Processing code: $CODE, output dir: $OUT_DIR"

    # 统计所有扩展名下的视频总数
    ALL_FILES=()
    for EXT in $VIDEO_EXTS; do
        for VID in "$VIDEO_DIR"/*.$EXT; do
            [ -e "$VID" ] || continue
            ALL_FILES+=("$VID")
        done
    done
    FILE_COUNT=${#ALL_FILES[@]}
    IDX=0
    for VID in "${ALL_FILES[@]}"; do
        IDX=$((IDX + 1))
        BASENAME=$(basename "$VID")
        PADDED_IDX=$(printf "%02d" "$IDX")
        OUTFILE="$OUT_DIR/${PADDED_IDX}_$BASENAME"
        echo "[$IDX/$FILE_COUNT] 正在处理: $BASENAME"
        # 获取视频时长
        DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$VID")
        # 计算水印出现的起始时间（结束前60秒）
        if (($(echo "$DURATION > 60" | bc -l))); then
            WM_START=$(echo "$DURATION-60" | bc)
        else
            WM_START=0
        fi
        # 在结束前60秒时出现，持续5秒
        ffmpeg -y -hide_banner -loglevel error -i "$VID" \
            -vf "drawtext=fontfile=$FONT_PATH:text='$CODE':fontcolor=white:fontsize=60:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h-text_h-60:enable='between(t,$WM_START,$(echo "$WM_START+5" | bc))'" \
            -c:v libx264 -c:a aac "$OUTFILE"
        echo "已处理: $OUTFILE"
    done

done

echo "全部处理完成！"
