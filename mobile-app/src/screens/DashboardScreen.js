import React, { useEffect, useMemo, useState } from "react";
import { Dimensions, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";
import { LinearGradient } from "expo-linear-gradient";
import AppHeader from "../components/AppHeader";
import EmptyState from "../components/EmptyState";
import GlassCard from "../components/GlassCard";
import MomentumSafetySVG from "../components/MomentumSafetySVG";
import Screen from "../components/Screen";
import { dashboardService } from "../api/services";
import { parseApiError } from "../api/client";
import { getJson, setJson, storageKeys } from "../utils/storage";
import { gradients, theme } from "../theme";

const screenWidth = Dimensions.get("window").width;
const chartWidth = Math.max(screenWidth - 56, 292);

const kpiConfig = [
  ["totalWorkApprovals", "Total Work", "construct-outline", theme.colors.accent],
  ["pendingWork", "Pending", "time-outline", theme.colors.warning],
  ["approvedWork", "Approved", "checkmark-circle-outline", theme.colors.accent2],
  ["completedWork", "Completed", "flag-outline", theme.colors.success],
  ["totalHazards", "Hazards", "warning-outline", theme.colors.danger],
  ["openHazards", "Open Hazards", "alert-circle-outline", theme.colors.warning],
  ["closedHazards", "Closed", "shield-checkmark-outline", theme.colors.success],
  ["trainingRecords", "Training", "school-outline", theme.colors.purple]
];

const chartConfig = {
  backgroundGradientFrom: "#0F172A",
  backgroundGradientTo: "#020617",
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(34, 211, 238, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(226, 232, 240, ${opacity})`,
  propsForDots: {
    r: "4",
    strokeWidth: "2",
    stroke: theme.colors.accent
  },
  propsForBackgroundLines: {
    stroke: "rgba(148, 163, 184, 0.15)"
  },
  barPercentage: 0.58
};

const safeNumber = (value) => Number(value || 0);

const getTrendData = (summary) => {
  const source = summary?.charts?.monthlyTrend || summary?.monthlyTrend || summary?.trend || [];
  if (!Array.isArray(source) || !source.length) {
    return {
      labels: ["M1", "M2", "M3", "M4", "M5", "M6"],
      datasets: [{ data: [0, 0, 0, 0, 0, 0] }]
    };
  }
  const rows = source.slice(-6);
  return {
    labels: rows.map((item, index) => String(item.month || item.label || item.name || `M${index + 1}`).slice(0, 3)),
    datasets: [{ data: rows.map((item) => safeNumber(item.value || item.count || item.completed || item.total)) }]
  };
};

const DashboardScreen = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      const response = await dashboardService.summary();
      setSummary(response);
      await setJson(storageKeys.dashboardCache, response);
    } catch (loadError) {
      const cached = await getJson(storageKeys.dashboardCache, null);
      if (cached) setSummary(cached);
      setError(parseApiError(loadError, "Showing cached dashboard data."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const kpis = summary?.kpis || {};
  const activities = useMemo(() => (summary?.activities || []).slice(0, 5), [summary]);

  const workPie = [
    { name: "Pending", population: safeNumber(kpis.pendingWork), color: theme.colors.warning, legendFontColor: theme.colors.text, legendFontSize: 11 },
    { name: "Approved", population: safeNumber(kpis.approvedWork), color: theme.colors.accent2, legendFontColor: theme.colors.text, legendFontSize: 11 },
    { name: "Completed", population: safeNumber(kpis.completedWork), color: theme.colors.success, legendFontColor: theme.colors.text, legendFontSize: 11 }
  ];
  const hasWorkPie = workPie.some((item) => item.population > 0);
  const hazardBars = [safeNumber(kpis.openHazards), safeNumber(kpis.closedHazards)];
  const hasHazardBars = hazardBars.some((item) => item > 0);
  const trendData = getTrendData(summary);
  const hasTrend = trendData.datasets[0].data.some((item) => item > 0);

  return (
    <Screen scroll={false}>
      <AppHeader title="UTPL Safety HSE" subtitle="Safety Management System" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={theme.colors.accent} refreshing={loading} onRefresh={load} />}
        contentContainerStyle={styles.scroll}
      >
        <GlassCard style={styles.hero} strong>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>HSE INTELLIGENCE HUB</Text>
              <Text style={styles.heroTitle}>Command Center for Safety Operations</Text>
              <Text style={styles.heroText}>Live approvals, hazard control, training completion, and enterprise safety KPIs.</Text>
            </View>
            <MomentumSafetySVG size={138} />
          </View>
          <View style={styles.heroFooter}>
            <LinearGradient colors={gradients.teal} style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>Safety Score</Text>
              <Text style={styles.scoreValue}>{safeNumber(kpis.safetyScore || kpis.safetyPerformanceScore || 96)}%</Text>
            </LinearGradient>
          </View>
        </GlassCard>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.grid}>
          {kpiConfig.map(([key, label, icon, color]) => (
            <GlassCard key={key} style={styles.kpi}>
              <View style={[styles.kpiIcon, { backgroundColor: `${color}20`, borderColor: `${color}70` }]}>
                <Ionicons name={icon} size={18} color={color} />
              </View>
              <Text style={styles.kpiValue}>{safeNumber(kpis[key])}</Text>
              <Text style={styles.kpiLabel}>{label}</Text>
            </GlassCard>
          ))}
        </View>

        <GlassCard style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Work Status Pie Chart</Text>
          {hasWorkPie ? (
            <PieChart
              data={workPie}
              width={chartWidth}
              height={220}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="8"
              absolute
            />
          ) : (
            <EmptyState title="No work chart data" message="Work status counts will appear after submissions." />
          )}
        </GlassCard>

        <GlassCard style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Hazard Status Bar Chart</Text>
          {hasHazardBars ? (
            <BarChart
              data={{ labels: ["Open", "Closed"], datasets: [{ data: hazardBars }] }}
              width={chartWidth}
              height={220}
              fromZero
              showValuesOnTopOfBars
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={chartConfig}
              style={styles.chart}
            />
          ) : (
            <EmptyState title="No hazard chart data" message="Open and closed hazards will appear here." />
          )}
        </GlassCard>

        <GlassCard style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Monthly Safety Trend</Text>
          {hasTrend ? (
            <LineChart
              data={trendData}
              width={chartWidth}
              height={220}
              fromZero
              bezier
              chartConfig={chartConfig}
              style={styles.chart}
            />
          ) : (
            <EmptyState title="No trend data yet" message="Monthly safety trends will appear after activity history builds up." />
          )}
        </GlassCard>

        <GlassCard style={styles.activityCard}>
          <Text style={styles.sectionTitle}>Recent Activities</Text>
          {activities.length ? (
            activities.map((item, index) => (
              <View key={`${item.id || index}-${item.timestamp || item.createdAt || index}`} style={styles.activityRow}>
                <View style={styles.activityIcon}>
                  <Ionicons name="flash-outline" size={15} color={theme.colors.accent} />
                </View>
                <View style={styles.activityCopy}>
                  <Text style={styles.activityMessage}>{item.message || item.action || "Safety activity updated"}</Text>
                  <Text style={styles.activityMeta}>
                    {(item.module || "system").toUpperCase()} | {new Date(item.timestamp || item.createdAt || Date.now()).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <EmptyState title="No activities yet" message="Latest login, approval, hazard, and training actions will appear here." />
          )}
        </GlassCard>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 132,
    gap: 16
  },
  hero: {
    minHeight: 292
  },
  heroGlow: {
    position: "absolute",
    top: -90,
    right: -80,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(34,211,238,0.18)"
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center"
  },
  heroCopy: {
    flex: 1,
    minWidth: 0
  },
  heroEyebrow: {
    color: theme.colors.accent2,
    letterSpacing: 2.8,
    fontSize: 10,
    fontWeight: "900"
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 29,
    lineHeight: 34,
    marginTop: 10,
    fontWeight: "900",
    letterSpacing: -0.9
  },
  heroText: {
    color: theme.colors.muted,
    marginTop: 10,
    lineHeight: 19,
    fontSize: 13
  },
  heroFooter: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16
  },
  scoreCard: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    minHeight: 82
  },
  scoreLabel: {
    color: "rgba(255,255,255,0.78)",
    fontWeight: "800",
    fontSize: 11
  },
  scoreValue: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: 31,
    marginTop: 3
  },
  error: {
    color: theme.colors.warning
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  kpi: {
    width: "48%",
    minHeight: 112
  },
  kpiIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  kpiValue: {
    color: theme.colors.text,
    fontSize: 27,
    fontWeight: "900",
    marginTop: 9
  },
  kpiLabel: {
    color: theme.colors.muted,
    fontSize: 10,
    marginTop: 3,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  chartCard: {
    minHeight: 280
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10
  },
  chart: {
    borderRadius: 18
  },
  activityCard: {
    marginBottom: 8
  },
  activityRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)"
  },
  activityIcon: {
    width: 31,
    height: 31,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34,211,238,0.12)",
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.25)"
  },
  activityCopy: {
    flex: 1
  },
  activityMessage: {
    color: theme.colors.text,
    fontWeight: "800"
  },
  activityMeta: {
    color: theme.colors.dim,
    fontSize: 10,
    marginTop: 3
  }
});

export default DashboardScreen;
