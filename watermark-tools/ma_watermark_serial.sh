#!/bin/bash

# 在脚本开头添加

export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# 检查参数

if [ "$#" -lt 3 ]; then
    echo "Usage: $0 <input_folder> <output_folder> <csv_file> [watermark_mode]"
    echo "Example: $0 ./input ./output users.csv [full|end|center]"
    echo "watermark_mode: full - 全程水印, end - 仅最后一分钟水印, center - 居中大号水印(默认)"
    exit 1
fi

# 定义参数

INPUT_FOLDER="$1"
OUTPUT_FOLDER="$2"
CSV_FILE="$3"
LOG_FILE="watermark.log"

# 支持的视频格式

VIDEO_FORMATS="mp4|mkv|avi|mov"

# 支持的图片格式

IMAGE_FORMATS="jpg|jpeg|png|webp"

# 添加水印模式参数
WATERMARK_MODE="${4:-full}" # 如果没有第4个参数，默认为 "end"

# 初始化日志

echo "Processing started at $(date)" >"$LOG_FILE"

# 在脚本开头添加环境检测函数
detect_os() {
    case "$(uname -s)" in
        Darwin*)
            echo "macos"
            ;;
        Linux*)
            echo "linux"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            echo "windows"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# 添加字体路径配置
get_font_path() {
    local os_type=$(detect_os)
    case "$os_type" in
        macos)
            echo "/System/Library/Fonts/PingFang.ttc"
            ;;
        windows)
            echo "C\\:/Windows/Fonts/msyh.ttc"
            ;;
        linux)
            # Linux 系统可能需要根据实际安装的字体修改
            echo "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
            ;;
        *)
            echo "Error: Unsupported operating system"
            exit 1
            ;;
    esac
}

# 检查命令是否存在
check_commands() {
    local os_type=$(detect_os)
    for cmd in ffmpeg magick; do
        if [ "$os_type" = "windows" ]; then
            if ! where $cmd >nul 2>&1; then
                echo "Error: $cmd is not installed"
                exit 1
            fi
        else
            if ! command -v $cmd &>/dev/null; then
                echo "Error: $cmd is not installed"
                exit 1
            fi
        fi
    done
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

    # 获取视频总时长（秒）
    duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$input_file")
    # 计算每个部分的时长
    section_duration=$(echo "$duration / 3" | bc -l)

    # 定义三个时间段的水印位置
    if [ "$WATERMARK_MODE" = "center" ]; then
        # 居中水印模式，字体调小
        local font_path=$(get_font_path)
        ffmpeg -nostdin -hide_banner -loglevel error \
            -i "$input_file" \
            -vf "drawtext=text='仅供以下人员查看学习，请勿公开传播，否则可能承担法律责任；识别码 ${wxid}(${nickname})':fontfile='${font_path}':fontsize=16:fontcolor=white:alpha=1:x=(w-text_w)/2:y=(h-text_h)/2" \
            -c:v libx264 \
            -codec:a copy \
            -y \
            "$output_file"
    elif [ "$WATERMARK_MODE" = "full" ]; then
        # 右下角位置
        position1="x=w-tw-10:y=h-th-30"
        # 中间位置
        position2="x=(w-tw)/2:y=(h-th)/2"
        # 左上角位置
        position3="x=10:y=10"

        # 时间过滤器
        time_filter1="lt(t,${section_duration})"
        time_filter2="gte(t,${section_duration})*lt(t,$(echo "$section_duration * 2" | bc))"
        time_filter3="gte(t,$(echo "$section_duration * 2" | bc))"
    else
        # 仅最后一分钟显示水印
        start_time=$(echo "$duration - 60" | bc)
        if (($(echo "$start_time < 0" | bc -l))); then
            time_filter1="lt(t,20)"
            time_filter2="gte(t,20)*lt(t,40)"
            time_filter3="gte(t,40)"
        else
            time_filter1="gte(t,${start_time})*lt(t,$(echo "$start_time + 20" | bc))"
            time_filter2="gte(t,$(echo "$start_time + 20" | bc))*lt(t,$(echo "$start_time + 40" | bc))"
            time_filter3="gte(t,$(echo "$start_time + 40" | bc))"
        fi
        position1="x=w-tw-10:y=h-th-30"
        position2="x=(w-tw)/2:y=(h-th)/2"
        position3="x=10:y=10"
    fi

    ffmpeg -nostdin -stats \
        -i "$input_file" \
        -vf "drawtext=text='该视频仅供 ${wxid} 学习，请勿二次传播或售卖，否则涉及到的法律责任将由 ${wxid} 承担':fontfile=/System/Library/Fonts/PingFang.ttc:fontsize=16:fontcolor=white@0.5:${position1}:enable='${time_filter1}',drawtext=text='仅供以下人员查看学习，请勿公开传播，否则可能承担法律责任：识别码 ${wxid}(${nickname})':fontfile=/System/Library/Fonts/PingFang.ttc:fontsize=16:fontcolor=white@0.5:${position2}:enable='${time_filter2}',drawtext=text='仅供以下人员查看学习，请勿公开传播，否则可能承担法律责任\n微信号或 ID：${wxid}(${nickname})':fontfile=/System/Library/Fonts/PingFang.ttc:fontsize=16:fontcolor=white@0.5:${position3}:enable='${time_filter3}'" \
        -c:v libx264 \
        -codec:a copy \
        -y \
        "$output_file"

    local status=$?
    if [ $status -eq 0 ]; then
        echo "Success: $output_file"
    else
        echo "Error processing video: $input_file (exit code: $status)"
        echo "Check $LOG_FILE for details"
    fi
}

# 处理单图片文件

process_image() {
    local input_file="$1"
    local wxid="$2"
    local nickname="$3"
    local user_output_dir="$4"

    local rel_path="${input_file#$INPUT_FOLDER/}"
    rel_path=$(echo "$rel_path" | sed 's|^\./||')
    local output_dir="$user_output_dir/$(dirname "$rel_path")"
    local filename=$(basename "$input_file")
    local output_file="$output_dir/${filename%.*}_${wxid}.${filename##*.}"

    mkdir -p "$output_dir"

    echo "Processing image: $rel_path for $wxid"
    local date_str=$(date '+%Y-%m-%d')

    local font_path=$(get_font_path)

    magick "$input_file" \
        \( -size 300x300 xc:none \
        -gravity center \
        -font "${font_path}" \
        -pointsize 26 \
        -fill black \
        -draw "rotate -45 text 0,0 'ID：${wxid}_${date_str}，勿公开传播\n\n否则可能承担法律责任'" \
        -channel A -evaluate multiply 0.15 \
        -write mpr:watermark +delete \
        -size 2000x2000 tile:mpr:watermark \) \
        -compose over -composite \
        "$output_file" 2>>"$LOG_FILE"

    if [ $? -eq 0 ]; then
        echo "Success: $output_file"
        echo "${wxid},${nickname},$(date '+%Y-%m-%d %H:%M:%S')" >>"id_mapping.csv"
    else
        echo "Error processing image: $input_file"
    fi
}

# 处理目录中的所有文件

process_directory() {
    local wxid="$1"
    local nickname="$2"
    local user_output_dir="$3"
    local current_user="$4"
    local total_users="$5"

    # 计算该用户下需要处理的总文件数
    local total_files=0
    local current_file=0

    # 统计视频文件数
    for format in ${VIDEO_FORMATS//|/ }; do
        total_files=$((total_files + $(find "$INPUT_FOLDER" -type f -iname "*.${format}" | wc -l)))
    done

    # 统计图片文件数
    for format in ${IMAGE_FORMATS//|/ }; do
        total_files=$((total_files + $(find "$INPUT_FOLDER" -type f -iname "*.${format}" | wc -l)))
    done

    echo "用户进度: [$current_user/$total_users] 处理 $wxid($nickname) 的文件"
    echo "该用户共有 $total_files 个文件需要处理"

    # 处理视频文件
    for format in ${VIDEO_FORMATS//|/ }; do
        local video_files=($(find "$INPUT_FOLDER" -type f -iname "*.${format}"))
        for file in "${video_files[@]}"; do
            current_file=$((current_file + 1))
            echo "文件进度: [$current_file/$total_files]"
            process_video "$file" "$wxid" "$nickname" "$user_output_dir"
        done
    done

    # 处理图片文件
    for format in ${IMAGE_FORMATS//|/ }; do
        local image_files=($(find "$INPUT_FOLDER" -type f -iname "*.${format}"))
        for file in "${image_files[@]}"; do
            current_file=$((current_file + 1))
            echo "文件进度: [$current_file/$total_files]"
            process_image "$file" "$wxid" "$nickname" "$user_output_dir"
        done
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

    # 计算总用户数
    local total_users=$(wc -l <"$CSV_FILE")
    local current_user=0

    while IFS=, read -r wxid nickname || [ -n "$wxid" ]; do
        current_user=$((current_user + 1))
        wxid=$(echo "$wxid" | tr -d '"' | tr -d ' ')
        nickname=$(echo "${nickname:-$wxid}" | tr -d '"' | tr -d ' ')

        local user_output_dir="$OUTPUT_FOLDER/$wxid"
        mkdir -p "$user_output_dir"

        echo "Processing for WeChat ID: $wxid, Nickname: $nickname"
        process_directory "$wxid" "$nickname" "$user_output_dir" "$current_user" "$total_users"
    done <"$CSV_FILE"

    echo "Processing complete! Check $LOG_FILE for details."

}

# 运行主程序

main
