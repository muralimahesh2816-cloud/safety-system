import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from "react-native-svg";
import { theme } from "../theme";

const MomentumSafetySVG = ({ size = 168 }) => {
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.in(Easing.quad), useNativeDriver: true })
      ])
    );
    spinLoop.start();
    pulseLoop.start();
    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [pulse, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.08] });

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]}>
        <View style={styles.pulse} />
      </Animated.View>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Svg width={size} height={size} viewBox="0 0 180 180">
          <Defs>
            <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#22D3EE" stopOpacity="1" />
              <Stop offset="0.5" stopColor="#2DD4BF" stopOpacity="0.75" />
              <Stop offset="1" stopColor="#FACC15" stopOpacity="0.85" />
            </LinearGradient>
            <LinearGradient id="shield" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#22D3EE" />
              <Stop offset="1" stopColor="#22C55E" />
            </LinearGradient>
          </Defs>
          <Circle cx="90" cy="90" r="74" stroke="rgba(148,163,184,0.24)" strokeWidth="2" fill="none" />
          <Circle cx="90" cy="90" r="74" stroke="url(#ring)" strokeWidth="8" strokeLinecap="round" strokeDasharray="190 80" fill="none" />
          {[0, 60, 120, 180, 240, 300].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x = 90 + Math.cos(rad) * 74;
            const y = 90 + Math.sin(rad) * 74;
            return <Circle key={angle} cx={x} cy={y} r="4" fill="#22D3EE" opacity="0.85" />;
          })}
        </Svg>
      </Animated.View>
      <Svg width={size * 0.58} height={size * 0.58} viewBox="0 0 100 100" style={styles.shield}>
        <Defs>
          <LinearGradient id="shieldFill" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#0EA5E9" />
            <Stop offset="1" stopColor="#22C55E" />
          </LinearGradient>
        </Defs>
        <Path
          d="M50 8 80 20v22c0 22-12.6 38.2-30 48C32.6 80.2 20 64 20 42V20L50 8Z"
          fill="url(#shieldFill)"
          opacity="0.95"
        />
        <Path d="M35 51 45 61 66 36" stroke="#F8FAFC" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <G opacity="0.28">
          <Circle cx="50" cy="50" r="44" stroke="#fff" strokeWidth="2" fill="none" />
        </G>
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  pulse: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: theme.colors.accent
  },
  shield: {
    position: "absolute"
  }
});

export default MomentumSafetySVG;
