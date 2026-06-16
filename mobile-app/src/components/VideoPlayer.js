import React from "react";
import { StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { theme } from "../theme";

const VideoPlayer = ({
  source,
  style,
  autoPlay = false,
  loop = false,
  muted = false,
  controls = true,
  contentFit = "contain"
}) => {
  const player = useVideoPlayer(source ? { uri: source } : null, (instance) => {
    instance.loop = loop;
    instance.muted = muted;
    if (autoPlay) instance.play();
  });

  if (!source) return <View style={[styles.empty, style]} />;

  return (
    <VideoView
      key={source}
      player={player}
      nativeControls={controls}
      allowsFullscreen
      allowsPictureInPicture
      contentFit={contentFit}
      style={[styles.video, style]}
    />
  );
};

const styles = StyleSheet.create({
  video: {
    backgroundColor: "#020617"
  },
  empty: {
    backgroundColor: "#020617",
    borderColor: theme.colors.border,
    borderWidth: 1
  }
});

export default VideoPlayer;
