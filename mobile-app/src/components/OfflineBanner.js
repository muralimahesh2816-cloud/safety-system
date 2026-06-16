import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNetwork } from "../context/NetworkContext";
import { theme } from "../theme";

const OfflineBanner = () => {
  const { online } = useNetwork();
  if (online) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Offline mode: cached data is available. Internet connection required to submit.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "rgba(245, 158, 11, 0.96)"
  },
  text: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 11,
    textAlign: "center"
  }
});

export default OfflineBanner;
