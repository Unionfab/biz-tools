#!/bin/bash

# 视频前几秒删除工具
# 使用 ffmpeg 自动删除视频文件的前几秒

# 设置语言环境
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# 显示使用方法
show_usage() {
    echo "使用方法: $0 [选项] <输入文件或目录>"
    echo ""
    echo "选项:"
    echo "  -s, --seconds <秒数>      要删除的秒数 (默认: 10)"
    echo "  -o, --output <目录>       输出目录 (默认: 当前目录)"
    echo "  -f, --force               强制覆盖已存在的文件"
    echo "  -r, --recursive           递归处理子目录"
    echo "  -v, --verbose             显示详细信息"
    echo "  -h, --help                显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 -s 15 input.mp4                    # 删除前15秒"
    echo "  $0 -s 5 -o ./output input.mp4         # 删除前5秒，输出到output目录"
    echo "  $0 -s 10 -r ./videos/                 # 递归处理videos目录下所有视频"
    echo "  $0 -s 8 -f -v input.mp4               # 删除前8秒，强制覆盖，显示详细信息"
    echo ""
    echo "支持的视频格式: mp4, mkv, avi, mov, wmv, flv, webm"
    exit 1
}

# 检查 ffmpeg 是否安装
check_ffmpeg() {
    if ! command -v ffmpeg &>/dev/null; then
        echo "错误: 未找到 ffmpeg。请先安装 ffmpeg。"
        echo "macOS: brew install ffmpeg"
        echo "Ubuntu/Debian: sudo apt install ffmpeg"
        echo "CentOS/RHEL: sudo yum install ffmpeg"
        exit 1
    fi
}

# 获取视频时长
get_video_duration() {
    local input_file="$1"
    local duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$input_file" 2>/dev/null)
    echo "$duration"
}

# 处理单个视频文件
process_video() {
    local input_file="$1"
    local output_file="$2"
    local trim_seconds="$3"

    # 获取视频时长
    local duration=$(get_video_duration "$input_file")
    if [ -z "$duration" ] || [ "$duration" = "N/A" ]; then
        echo "警告: 无法获取视频时长，跳过文件: $input_file"
        return 1
    fi

    # 检查视频时长是否足够
    if (($(echo "$duration <= $trim_seconds" | bc -l))); then
        echo "警告: 视频时长 ($duration 秒) 小于要删除的时长 ($trim_seconds 秒)，跳过文件: $input_file"
        return 1
    fi

    # 创建输出目录
    local output_dir=$(dirname "$output_file")
    mkdir -p "$output_dir"

    # 构建 ffmpeg 命令
    local ffmpeg_cmd="ffmpeg -i \"$input_file\" -ss $trim_seconds -c copy"

    # 添加输出选项
    if [ "$FORCE_OVERWRITE" = "true" ]; then
        ffmpeg_cmd="$ffmpeg_cmd -y"
    else
        ffmpeg_cmd="$ffmpeg_cmd -n"
    fi

    # 添加日志级别
    if [ "$VERBOSE" = "true" ]; then
        ffmpeg_cmd="$ffmpeg_cmd -loglevel info"
    else
        ffmpeg_cmd="$ffmpeg_cmd -loglevel error"
    fi

    ffmpeg_cmd="$ffmpeg_cmd \"$output_file\""

    # 执行 ffmpeg 命令
    if [ "$VERBOSE" = "true" ]; then
        echo "执行命令: $ffmpeg_cmd"
    fi

    if eval $ffmpeg_cmd; then
        local new_duration=$(get_video_duration "$output_file")
        local saved_time=$(echo "$duration - $new_duration" | bc -l)
        echo "✅ 成功处理: $(basename "$input_file")"
        echo "   原始时长: ${duration}秒"
        echo "   处理后时长: ${new_duration}秒"
        echo "   节省时间: ${saved_time}秒"
        return 0
    else
        echo "❌ 处理失败: $(basename "$input_file")"
        return 1
    fi
}

# 主处理函数
main() {
    local input_path="$1"
    local trim_seconds="${TRIM_SECONDS:-10}"
    local output_dir="${OUTPUT_DIR:-.}"
    local processed_count=0
    local success_count=0
    local failed_count=0

    # 支持的视频格式
    local video_extensions=("mp4" "mkv" "avi" "mov" "wmv" "flv" "webm")

    echo "开始处理视频文件..."
    echo "删除时长: ${trim_seconds}秒"
    echo "输出目录: $output_dir"
    echo "----------------------------------------"

    # 如果是文件
    if [ -f "$input_path" ]; then
        local filename=$(basename "$input_path")
        local extension="${filename##*.}"
        local name_without_ext="${filename%.*}"

        # 检查是否为支持的视频格式
        local is_video=false
        for ext in "${video_extensions[@]}"; do
            if [[ "${extension,,}" == "$ext" ]]; then
                is_video=true
                break
            fi
        done

        if [ "$is_video" = "true" ]; then
            local output_file="$output_dir/${name_without_ext}_trimmed.${extension}"
            processed_count=$((processed_count + 1))

            if process_video "$input_path" "$output_file" "$trim_seconds"; then
                success_count=$((success_count + 1))
            else
                failed_count=$((failed_count + 1))
            fi
        else
            echo "跳过非视频文件: $filename"
        fi

    # 如果是目录
    elif [ -d "$input_path" ]; then
        local find_cmd="find \"$input_path\" -type f"
        if [ "$RECURSIVE" != "true" ]; then
            find_cmd="$find_cmd -maxdepth 1"
        fi

        # 构建文件扩展名条件
        local ext_conditions=""
        for ext in "${video_extensions[@]}"; do
            if [ -z "$ext_conditions" ]; then
                ext_conditions="-iname \"*.$ext\""
            else
                ext_conditions="$ext_conditions -o -iname \"*.$ext\""
            fi
        done

        find_cmd="$find_cmd \\( $ext_conditions \\)"

        # 处理找到的视频文件
        while IFS= read -r -d '' file; do
            local filename=$(basename "$file")
            local extension="${filename##*.}"
            local name_without_ext="${filename%.*}"
            local rel_path="${file#$input_path/}"
            local output_file="$output_dir/${rel_path%.*}_trimmed.${extension}"

            processed_count=$((processed_count + 1))

            if process_video "$file" "$output_file" "$trim_seconds"; then
                success_count=$((success_count + 1))
            else
                failed_count=$((failed_count + 1))
            fi

            echo "----------------------------------------"
        done < <(eval "$find_cmd" -print0)

    else
        echo "错误: 输入路径不存在: $input_path"
        exit 1
    fi

    # 显示统计信息
    echo ""
    echo "处理完成!"
    echo "总处理文件数: $processed_count"
    echo "成功处理: $success_count"
    echo "处理失败: $failed_count"

    if [ $failed_count -gt 0 ]; then
        exit 1
    fi
}

# 解析命令行参数
TRIM_SECONDS=10
OUTPUT_DIR="."
FORCE_OVERWRITE="false"
RECURSIVE="false"
VERBOSE="false"

while [[ $# -gt 0 ]]; do
    case $1 in
    -s | --seconds)
        TRIM_SECONDS="$2"
        shift 2
        ;;
    -o | --output)
        OUTPUT_DIR="$2"
        shift 2
        ;;
    -f | --force)
        FORCE_OVERWRITE="true"
        shift
        ;;
    -r | --recursive)
        RECURSIVE="true"
        shift
        ;;
    -v | --verbose)
        VERBOSE="true"
        shift
        ;;
    -h | --help)
        show_usage
        ;;
    -*)
        echo "错误: 未知选项 $1"
        show_usage
        ;;
    *)
        break
        ;;
    esac
done

# 检查参数
if [ $# -eq 0 ]; then
    echo "错误: 请指定输入文件或目录"
    show_usage
fi

# 验证秒数参数
if ! [[ "$TRIM_SECONDS" =~ ^[0-9]+(\.[0-9]+)?$ ]] || (($(echo "$TRIM_SECONDS <= 0" | bc -l))); then
    echo "错误: 秒数必须是正数"
    exit 1
fi

# 检查 ffmpeg
check_ffmpeg

# 检查 bc 命令（用于浮点数计算）
if ! command -v bc &>/dev/null; then
    echo "错误: 未找到 bc 命令。请安装 bc。"
    echo "macOS: brew install bc"
    echo "Ubuntu/Debian: sudo apt install bc"
    echo "CentOS/RHEL: sudo yum install bc"
    exit 1
fi

# 执行主程序
main "$1"
