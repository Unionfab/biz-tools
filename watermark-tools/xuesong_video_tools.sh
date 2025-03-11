#!/bin/bash

# Function to check if ffmpeg is installed
check_ffmpeg() {
    if ! command -v ffmpeg &>/dev/null; then
        echo "Error: ffmpeg is not installed. Please install it first."
        exit 1
    fi
}

# Function to validate input file exists
check_file_exists() {
    if [ ! -f "$1" ]; then
        echo "Error: File $1 does not exist"
        exit 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [options]"
    echo "Required options:"
    echo "  --input-audio=<file>     Input audio file"
    echo "  --tempo-speed=<speed>    Tempo speed adjustment (e.g., 0.6)"
    echo "Optional options:"
    echo "  --image-dir=<dir>        Directory containing images"
    echo "  --output-dir=<dir>       Output directory (default: same as input)"
    echo "  --skip-audio             Skip audio processing"
    echo "  --force                  Force overwrite existing files"
    echo ""
    echo "Examples:"
    echo "  $0 --input-audio=input.mp3 --tempo-speed=0.6"
    echo "  $0 --input-audio=input.mp3 --tempo-speed=0.6 --image-dir=/path/to/images"
    echo "  $0 --input-audio=input.mp3 --tempo-speed=0.6 --skip-audio"
    echo "  $0 --input-audio=input.mp3 --tempo-speed=0.6 --force"
    exit 1
}

# Main script
echo "Audio Processing Tool"

# Initialize variables
input_audio=""
tempo_speed=""
image_dir=""
output_dir=""
skip_audio=0
force_overwrite=0

# Parse named arguments
for i in "$@"; do
    case $i in
    --input-audio=*)
        input_audio="${i#*=}"
        shift
        ;;
    --tempo-speed=*)
        tempo_speed="${i#*=}"
        shift
        ;;
    --image-dir=*)
        image_dir="${i#*=}"
        shift
        ;;
    --output-dir=*)
        output_dir="${i#*=}"
        shift
        ;;
    --skip-audio)
        skip_audio=1
        shift
        ;;
    --force)
        force_overwrite=1
        shift
        ;;
    --help)
        show_usage
        ;;
    *)
        echo "Unknown option: $i"
        show_usage
        ;;
    esac
done

# Validate required parameters
if [ -z "$input_audio" ] || [ -z "$tempo_speed" ]; then
    echo "Error: Missing required parameters"
    show_usage
fi

# Set default output directory if not specified
if [ -z "$output_dir" ]; then
    output_dir=$(dirname "$input_audio")
fi

# Create output directory if it doesn't exist
mkdir -p "$output_dir"

# Validate inputs
check_ffmpeg
check_file_exists "$input_audio"

# Process audio if not skipped
if [ "$skip_audio" -eq 0 ]; then
    echo "Processing audio..."
    output_audio="$output_dir/output_audio-${tempo_speed}.mp3"

    # Check if output file exists
    if [ -f "$output_audio" ] && [ "$force_overwrite" -eq 0 ]; then
        echo "Error: Output file '$output_audio' already exists. Use --force to overwrite."
        exit 1
    fi

    # Create temporary directory for processing
    temp_dir="$output_dir/temp_processing"
    mkdir -p "$temp_dir"

    # Split audio into 30-minute segments for processing
    echo "Splitting audio into segments..."
    ffmpeg -i "$input_audio" -f segment -segment_time 1800 -c copy "$temp_dir/segment_%03d.mp3"

    # Process each segment
    echo "Processing segments..."
    for segment in "$temp_dir"/segment_*.mp3; do
        segment_name=$(basename "$segment")
        output_segment="$temp_dir/processed_${segment_name}"

        ffmpeg -i "$segment" \
            -af "atempo=$tempo_speed,arnndn=m=./std.rnnn" \
            -acodec libmp3lame -q:a 2 \
            -ac 2 -ar 44100 \
            -y "$output_segment"
    done

    # Concatenate processed segments
    echo "Combining processed segments..."
    # Create concat file
    for processed in "$temp_dir"/processed_segment_*.mp3; do
        echo "file '$processed'" >>"$temp_dir/concat.txt"
    done

    # Combine all segments
    ffmpeg -f concat -safe 0 -i "$temp_dir/concat.txt" -c copy "$output_audio"

    # Clean up temporary files
    rm -rf "$temp_dir"

    # Verify the output audio
    output_duration=$(ffprobe -i "$output_audio" -show_entries format=duration -v quiet -of csv="p=0")
    input_duration=$(ffprobe -i "$input_audio" -show_entries format=duration -v quiet -of csv="p=0")
    expected_duration=$(echo "$input_duration / $tempo_speed" | bc -l)

    echo "Input duration: $input_duration seconds"
    echo "Output duration: $output_duration seconds"
    echo "Expected duration: $expected_duration seconds"
else
    echo "Skipping audio processing..."
    output_audio="$input_audio"
fi

# If image directory is provided, create video
if [ ! -z "$image_dir" ] && [ -d "$image_dir" ]; then
    echo "Image directory provided, creating video..."
    output_name="$output_dir/output_video.mp4"

    # Check if output video file exists
    if [ -f "$output_name" ] && [ "$force_overwrite" -eq 0 ]; then
        echo "Error: Output file '$output_name' already exists. Use --force to overwrite."
        exit 1
    fi

    # Create a list of images
    echo "Creating image list..."
    find "$image_dir" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) >"$output_dir/image_list.txt"

    # Get audio duration (use bc for more precise calculation)
    duration=$(ffprobe -i "$output_audio" -show_entries format=duration -v quiet -of csv="p=0")
    duration=$(printf "%.3f" "$duration") # Round to 3 decimal places

    # Count number of images
    image_count=$(wc -l <"$output_dir/image_list.txt")

    if [ "$image_count" -eq 0 ]; then
        echo "No images found in directory. Only audio will be processed."
        rm -f "$output_dir/image_list.txt"
        exit 0
    fi

    # Calculate duration per image (use bc for precise division)
    duration_per_image=$(echo "scale=3; $duration / $image_count" | bc)

    echo "Total audio duration: $duration seconds"
    echo "Number of images: $image_count"
    echo "Duration per image: $duration_per_image seconds"

    # Create video from images and audio
    echo "Creating video..."
    concat_file="$output_dir/concat.txt"
    >"$concat_file" # Clear file if it exists

    while IFS= read -r img; do
        printf "file '%s'\nduration %s\n" "${img//\'/\'\\\'\'}" "$duration_per_image" >>"$concat_file"
    done <"$output_dir/image_list.txt"

    # Add the last image one more time without duration (required by concat demuxer)
    last_image=$(tail -n 1 "$output_dir/image_list.txt")
    printf "file '%s'\n" "${last_image//\'/\'\\\'\'}" >>"$concat_file"

    ffmpeg -f concat -safe 0 \
        -i "$concat_file" \
        -i "$output_audio" \
        -vf "fps=25,format=yuv420p" \
        -c:v libx264 -c:a aac \
        ${force_overwrite:+-y} \
        -shortest "$output_name"

    # Verify final video duration
    video_duration=$(ffprobe -i "$output_name" -show_entries format=duration -v quiet -of csv="p=0")
    echo "Final video duration: $video_duration seconds"
    echo "Audio duration: $duration seconds"

    # Cleanup temporary files
    rm -f "$output_dir/image_list.txt" "$concat_file"
    echo "Video creation complete! Output saved as: $output_name"
else
    echo "Audio processing complete! Output saved as: $output_audio"
fi
