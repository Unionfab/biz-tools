#!/bin/bash

# 检查是否安装了ffmpeg
if ! command -v ffmpeg &>/dev/null; then
    echo "错误: 请先安装 ffmpeg"
    exit 1
fi

# 检查输入参数
if [ $# -lt 1 ] || [ $# -gt 2 ]; then
    echo "使用方法: $0 <图片文件夹路径> [rotate]"
    echo "参数说明:"
    echo "  rotate: 可选参数，设置为 'no' 则不进行逆时针旋转"
    exit 1
fi

# 生成随机水印码
generate_watermark_code() {
    # 使用 LC_ALL=C 来避免字符集问题
    LC_ALL=C cat /dev/urandom | LC_ALL=C tr -dc 'a-zA-Z0-9' | fold -w 8 | head -n 1
}

# 为整批图片生成一个水印码
BATCH_WATERMARK_CODE=$(generate_watermark_code)
echo "本批次水印码: $BATCH_WATERMARK_CODE"

# 处理图片函数
process_image() {
    local input_file="$1"
    local filename=$(basename "$input_file")
    local name_without_ext="${filename%.*}" # 获取不带扩展名的文件名
    local extension="${filename##*.}"       # 获取扩展名
    local output_file="${OUTPUT_DIR}/${name_without_ext}_${BATCH_WATERMARK_CODE}.${extension}"

    echo "正在处理: $filename"
    echo "输入文件完整路径: $input_file"
    echo "输出文件完整路径: $output_file"
    echo "水印码: $BATCH_WATERMARK_CODE"

    # 检查输入文件是否存在
    if [ ! -f "$input_file" ]; then
        echo "错误: 输入文件不存在: $input_file"
        return 1
    fi

    # 根据rotate参数决定是否添加transpose滤镜
    local filter=""
    if [ "$ROTATE" = "yes" ]; then
        filter="transpose=2,"
    fi
    filter="${filter}eq=contrast=1.2:brightness=-0.1"

    # 生成水印网格
    for ((i = -5; i < 15; i++)); do
        for ((j = -5; j < 15; j++)); do
            filter="${filter},drawtext=text='${BATCH_WATERMARK_CODE}':x=(w/10)*${i}+(h/10)*${j}/1.5-w/4:y=(h/10)*${j}-h/4:fontsize=18:fontcolor=white@0.1:box=1:boxcolor=black@0.025:font=Arial"
        done
    done

    # 使用ffmpeg添加水印（静默模式）
    ffmpeg -y -i "$input_file" \
        -vf "${filter}" \
        -frames:v 1 -update 1 -q:v 2 -c:v mjpeg \
        -loglevel error \
        "$output_file"

    if [ $? -eq 0 ]; then
        echo "成功处理: $filename"
    else
        echo "处理失败: $filename"
    fi
}

# 获取输入目录的绝对路径
INPUT_DIR=$(cd "$1" && pwd)
OUTPUT_DIR="${INPUT_DIR}/watermarked"

# 设置旋转参数
ROTATE="yes"
if [ $# -eq 2 ] && [ "$2" = "no" ]; then
    ROTATE="no"
fi

# 检查目录是否存在
if [ ! -d "$INPUT_DIR" ]; then
    echo "错误: 目录 '$INPUT_DIR' 不存在"
    exit 1
fi

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 遍历目录中的所有图片文件
echo "开始处理图片..."
echo "输入目录: $INPUT_DIR"
echo "输出目录: $OUTPUT_DIR"
echo "查找所有图片文件..."

# 切换到输入目录
cd "$INPUT_DIR"

# 使用 ls 和 for 循环处理文件
for file in *.JPG *.jpg *.JPEG *.jpeg *.PNG *.png; do
    # 检查文件是否存在（避免处理通配符本身）
    if [ -f "$file" ]; then
        full_path="$INPUT_DIR/$file"
        echo "找到文件: $full_path"
        process_image "$full_path"
    fi
done

echo "处理完成! 水印图片保存在: $OUTPUT_DIR"
