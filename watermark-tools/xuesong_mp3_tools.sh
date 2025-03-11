#!/bin/bash

# 设置脚本执行时的错误处理
set -e

# 显示使用方法
show_usage() {
    echo "使用方法: $0 <输入目录>"
    echo "示例: $0 ./wav_files"
    echo "将会处理指定目录下的所有.wav文件并转换为mp3格式"
}

# 检查是否安装了ffmpeg
check_ffmpeg() {
    if ! command -v ffmpeg &>/dev/null; then
        echo "错误: 未找到ffmpeg。请先安装ffmpeg。"
        echo "Ubuntu/Debian: sudo apt-get install ffmpeg"
        echo "MacOS: brew install ffmpeg"
        exit 1
    fi
}

# 转换函数
convert_to_mp3() {
    local input_file="$1"
    local output_file="${input_file%.*}.mp3"

    echo "正在转换: $input_file -> $output_file"
    ffmpeg -i "$input_file" -acodec libmp3lame -q:a 0 "$output_file" -y
}

# 主程序
main() {
    # 检查参数
    if [ $# -ne 1 ]; then
        show_usage
        exit 1
    fi

    # 检查输入目录是否存在
    input_dir="$1"
    if [ ! -d "$input_dir" ]; then
        echo "错误: 目录 '$input_dir' 不存在"
        exit 1
    fi

    # 检查ffmpeg是否已安装
    check_ffmpeg

    # 计数器
    local success_count=0
    local fail_count=0

    # 处理所有wav文件
    echo "开始转换处理..."
    while IFS= read -r -d '' file; do
        if convert_to_mp3 "$file"; then
            ((success_count++))
        else
            ((fail_count++))
            echo "警告: 转换失败 - $file"
        fi
    done < <(find "$input_dir" -type f -name "*.wav" -print0)

    # 输出统计信息
    echo "转换完成！"
    echo "成功: $success_count 个文件"
    echo "失败: $fail_count 个文件"
}

# 执行主程序
main "$@"
