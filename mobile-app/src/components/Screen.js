import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { gradients, theme } from "../theme";

const Screen = ({ children, scroll = true, refreshing = false, onRefresh, contentStyle }) => {
  const insets = useSafeAreaInsets();
  const paddingTop = Math.max(insets.top + 12, 18);
  const paddingBottom = Math.max(insets.bottom + 96, 110);

  const body = (
    <View style={[styles.content, { paddingTop, paddingBottom }, contentStyle]}>{children}</View>
  );

  return (
    <LinearGradient colors={gradients.app} style={styles.root}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl tintColor={theme.colors.accent} refreshing={refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
        >
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  content: {
    paddingHorizontal: theme.spacing.screen
  }
});

export default Screen;
