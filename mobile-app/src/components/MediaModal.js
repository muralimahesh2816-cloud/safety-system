import React, { useMemo, useState } from "react";
import { Image, Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import VideoPlayer from "./VideoPlayer";
import { getMediaUrl, isVideoUrl } from "../utils/media";
import { theme } from "../theme";

const MediaModal = ({ visible, media, onClose }) => {
  const [scale, setScale] = useState(1);
  const url = useMemo(() => getMediaUrl(media), [media]);
  const video = isVideoUrl(url) || media?.type === "video";

  if (!url) return null;

  return (
    <Modal visible={Boolean(visible)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.toolbar}>
          <Text style={styles.title}>Media Preview</Text>
          <View style={styles.actions}>
            {!video ? (
              <>
                <TouchableOpacity style={styles.iconButton} onPress={() => setScale((prev) => Math.max(1, prev - 0.25))}>
                  <Ionicons name="remove" size={18} color={theme.colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => setScale((prev) => Math.min(3, prev + 0.25))}>
                  <Ionicons name="add" size={18} color={theme.colors.text} />
                </TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity style={styles.iconButton} onPress={() => Linking.openURL(url)}>
              <Ionicons name="open-outline" size={18} color={theme.colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.close} onPress={onClose}>
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.stage}>
          {video ? (
            <VideoPlayer key={url} source={url} controls autoPlay contentFit="contain" style={styles.video} />
          ) : (
            <Image source={{ uri: url }} style={[styles.image, { transform: [{ scale }] }]} resizeMode="contain" />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.96)",
    paddingTop: 48,
    paddingHorizontal: 14,
    paddingBottom: 24
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14
  },
  title: {
    color: theme.colors.text,
    fontWeight: "900"
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  close: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(251,113,133,0.18)",
    borderWidth: 1,
    borderColor: "rgba(251,113,133,0.35)"
  },
  stage: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "#020617",
    alignItems: "center",
    justifyContent: "center"
  },
  image: {
    width: "100%",
    height: "100%"
  },
  video: {
    width: "100%",
    height: "100%"
  }
});

export default MediaModal;
