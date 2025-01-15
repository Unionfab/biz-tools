#!/bin/bash

# 在脚本开头添加
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# 检查参数
if [ "$#" -ne 3 ]; then
    echo "Usage: $0 <input_folder> <output_folder> <csv_file>"
    echo "Example: $0 ./input ./output users.csv"
    exit 1
fi

# 定义参数
INPUT_FOLDER="$1"
OUTPUT_FOLDER="$2"
CSV_FILE="$3"
# 设置最大并发数
MAX_JOBS=4

# 支持的视频格式
VIDEO_FORMATS="mp4|mkv|avi|mov"
# 支持的图片格式
IMAGE_FORMATS="jpg|jpeg|png|webp"

# 检查必要的命令是否存在
check_commands() {
    for cmd in ffmpeg convert; do
        if ! command -v $cmd &>/dev/null; then
            echo "Error: $cmd is not installed"
            exit 1
        fi
    done
}

# 等待所有后台任务完成
wait_jobs() {
    local current_jobs=$(jobs -p | wc -l)
    if [ $current_jobs -ge $MAX_JOBS ]; then
        wait -n
    fi
}

# 检查是否为 Apple Silicon
check_apple_silicon() {
    if [[ "$(uname)" == "Darwin" && "$(uname -m)" == "arm64" ]]; then
        return 0 # true
    else
        return 1 # false
    fi
}

# 处理单个视频文件
process_video() {
    local input_file="$1"
    local wxid="$2"
    local nickname="$3"
    local user_output_dir="$4"

    local rel_path="${input_file#$INPUT_FOLDER/}"
    local output_dir="$user_output_dir/$(dirname "$rel_path")"
    local filename=$(basename "$input_file")
    local output_file="$output_dir/${filename%.*}_${wxid}.${filename##*.}"

    mkdir -p "$output_dir"

    echo "Processing video: $rel_path for $wxid ($nickname)"

    if check_apple_silicon; then
        ffmpeg -nostdin -hide_banner -loglevel error -i "$input_file" \
            -vf "drawtext=text='仅供以下人员查看学习，请勿公开传播，否则可能承担法律责任':fontsize=24:fontcolor=white@0.3:x='mod(t*50\,w)':y='mod(t*30\,h)',drawtext=text='微信号：${wxid}（${nickname}）':fontsize=24:fontcolor=white@0.3:x='mod(t*50\,w)':y='mod(t*30\,h)+50'" \
            -c:v h264_videotoolbox \
            -b:v 5M \
            -codec:a copy \
            -y \
            "$output_file"
    else
        ffmpeg -nostdin -hide_banner -loglevel error -i "$input_file" \
            -vf "drawtext=text='仅供以下人员查看学习，请勿公开传播，否则可能承担法律责任':fontsize=24:fontcolor=white@0.3:x='mod(t*50\,w)':y='mod(t*30\,h)',drawtext=text='微信号：${wxid}（${nickname}）':fontsize=24:fontcolor=white@0.3:x='mod(t*50\,w)':y='mod(t*30\,h)+50'" \
            -codec:a copy \
            -y \
            "$output_file"
    fi
}

# 处理单个图片文件
process_image() {
    local input_file="$1"
    local wxid="$2"
    local nickname="$3"
    local user_output_dir="$4"

    local rel_path="${input_file#$INPUT_FOLDER/}"
    local output_dir="$user_output_dir/$(dirname "$rel_path")"
    local filename=$(basename "$input_file")
    local output_file="$output_dir/${filename%.*}_${wxid}.${filename##*.}"

    mkdir -p "$output_dir"

    echo "Processing image: $rel_path for $wxid"

    local unique_id=$(echo "${wxid}_$(date +%s)" | md5sum | cut -c1-8)

    # 在后台执行 convert
    convert "$input_file" \
        -gravity NorthWest \
        -pointsize 24 \
        -fill white -stroke black -strokewidth 1 \
        -annotate +10+10 "仅供以下人员查看学习，请勿公开传播，否则可能承担法律责任" \
        -gravity SouthEast \
        -pointsize 24 \
        -fill white -stroke black -strokewidth 1 \
        -annotate +10+10 "唯一识别码：${unique_id}" \
        "$output_file" &

    # 记录唯一识别码
    echo "${unique_id},${wxid},${nickname},$(date '+%Y-%m-%d %H:%M:%S')" >>"id_mapping.csv"

    # 等待如果达到最大并发数
    wait_jobs
}

# 处理目录中的所有文件
process_directory() {
    local wxid="$1"
    local nickname="$2"
    local user_output_dir="$3"

    # 处理视频文件
    echo "Processing videos..."
    find "$INPUT_FOLDER" -type f -name "*.mp4" | while read -r file; do
        process_video "$file" "$wxid" "$nickname" "$user_output_dir"
    done

    # 处理图片文件
    echo "Processing images..."
    find "$INPUT_FOLDER" -type f -name "*.jpg" | while read -r file; do
        process_image "$file" "$wxid" "$nickname" "$user_output_dir"
    done
}

# 主程序
main() {
    check_commands

    if [ ! -f "$CSV_FILE" ]; then
        echo "Error: CSV file not found!"
        exit 1
    fi

    if [ ! -d "$INPUT_FOLDER" ]; then
        echo "Error: Input folder not found!"
        exit 1
    fi

    echo "Cleaning output directory: $OUTPUT_FOLDER"
    rm -rf "$OUTPUT_FOLDER"
    mkdir -p "$OUTPUT_FOLDER"

    echo "unique_id,wxid,nickname,timestamp" >"id_mapping.csv"

    # 读取 CSV 文件并并行处理每个用户
    while IFS=, read -r wxid nickname || [ -n "$wxid" ]; do
        wxid=$(echo "$wxid" | tr -d '"' | tr -d ' ')
        nickname=$(echo "$nickname" | tr -d '"' | tr -d ' ')

        local user_output_dir="$OUTPUT_FOLDER/$wxid"
        mkdir -p "$user_output_dir"

        echo "Processing for WeChat ID: $wxid, Nickname: $nickname"
        process_directory "$wxid" "$nickname" "$user_output_dir" &
    done <"$CSV_FILE"

    # 等待所有后台任务完成
    wait

    echo "Processing complete!"
}

# 运行主程序
main
