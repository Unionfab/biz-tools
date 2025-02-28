#!/bin/bash

# 检查是否安装了 HandBrakeCLI
if ! command -v HandBrakeCLI &>/dev/null; then
    echo "错误: 未找到 HandBrakeCLI。请先安装 HandBrake。"
    exit 1
fi

# 显示使用方法
usage() {
    echo "使用方法: $0 <输入文件夹> <输出文件夹>"
    echo "示例: $0 ./input_videos ./compressed_videos"
    exit 1
}

# 检查参数
if [ "$#" -ne 2 ]; then
    usage
fi

INPUT_DIR="$1"
OUTPUT_DIR="$2"

# 检查输入文件夹是否存在
if [ ! -d "$INPUT_DIR" ]; then
    echo "错误: 输入文件夹 '$INPUT_DIR' 不存在"
    exit 1
fi

# 创建输出文件夹（如果不存在）
mkdir -p "$OUTPUT_DIR"

# 支持的视频格式
video_formats=("mp4" "mkv" "avi" "mov" "wmv" "flv")

# 遍历输入文件夹中的所有视频文件
for format in "${video_formats[@]}"; do
    find "$INPUT_DIR" -type f -name "*.$format" | while read -r input_file; do
        # 获取相对路径并创建输出文件路径
        rel_path=${input_file#$INPUT_DIR/}
        output_file="$OUTPUT_DIR/${rel_path%.*}.mp4"

        # 创建输出文件的目录
        mkdir -p "$(dirname "$output_file")"

        echo "正在压缩: $input_file"
        echo "输出到: $output_file"

        # 使用 HandBrakeCLI 进行视频压缩
        # 参数说明：
        # --preset="Fast 1080p30" : 使用快速1080p30预设
        # --optimize : 开启Web优化
        # --encoder x264 : 使用x264编码器
        # --quality 22 : RF值，范围0-51，越小质量越好，22是较好的平衡点
        # --rate 30 : 帧率限制为30fps
        # --maxWidth 1920 : 最大宽度1920像素
        # --maxHeight 1080 : 最大高度1080像素
        HandBrakeCLI \
            --preset="Fast 1080p30" \
            --optimize \
            --encoder x264 \
            --quality 22 \
            --rate 30 \
            --maxWidth 1920 \
            --maxHeight 1080 \
            -i "$input_file" \
            -o "$output_file"

        if [ $? -eq 0 ]; then
            echo "✅ 压缩完成: $output_file"
        else
            echo "❌ 压缩失败: $input_file"
        fi
        echo "----------------------------------------"
    done
done

echo "所有视频处理完成！"
