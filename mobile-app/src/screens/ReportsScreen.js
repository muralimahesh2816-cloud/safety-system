import React, { useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AppHeader from "../components/AppHeader";
import ChipSelect from "../components/ChipSelect";
import EmptyState from "../components/EmptyState";
import GlassCard from "../components/GlassCard";
import Loader from "../components/Loader";
import Screen from "../components/Screen";
import { parseApiError } from "../api/client";
import { reportService } from "../api/services";
import { theme } from "../theme";

const periods = ["daily", "weekly", "monthly", "yearly"];
const reportTypes = ["work", "hazard", "training"];

const ReportsScreen = () => {
  const [period, setPeriod] = useState("monthly");
  const [type, setType] = useState("work");
  const [analytics, setAnalytics] = useState(null);
  const [rows, setRows] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadAnalytics = async () => {
    setRefreshing(true);
    try {
      const response = await reportService.analytics(period);
      setAnalytics(response.analytics);
    } catch (_error) {
      setAnalytics(null);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const generate = async () => {
    setBusy(true);
    try {
      if (type === "work") setRows(await reportService.work());
      else if (type === "hazard") setRows(await reportService.hazard());
      else {
        const response = await reportService.exportRows("json", period);
        setRows((response.rows || []).filter((row) => row.module === "training"));
      }
      Alert.alert("Success", "Report Generated Successfully");
    } catch (error) {
      Alert.alert("Report failed", parseApiError(error, "Unable to generate report."));
    } finally {
      setBusy(false);
    }
  };

  const totals = useMemo(() => analytics?.totals || {}, [analytics]);

  return (
    <Screen scroll={false}>
      <AppHeader title="UTPL Safety HSE" subtitle="Reports & Analytics" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={theme.colors.accent} refreshing={refreshing} onRefresh={loadAnalytics} />}
        contentContainerStyle={styles.scroll}
      >
        <GlassCard>
          <Text style={styles.sectionTitle}>Report Generator</Text>
          <Text style={styles.label}>Period</Text>
          <ChipSelect options={periods} value={period} onChange={setPeriod} />
          <Text style={styles.label}>Report Type</Text>
          <ChipSelect options={reportTypes} value={type} onChange={setType} />
          <TouchableOpacity style={styles.generate} onPress={generate} disabled={busy}>
            <Text style={styles.generateText}>{busy ? "Generating..." : "Generate Report"}</Text>
          </TouchableOpacity>
        </GlassCard>

        <View style={styles.grid}>
          {[
            ["Work", totals.work || 0],
            ["Hazards", totals.hazards || 0],
            ["Users", totals.users || 0],
            ["Training", totals.training || 0]
          ].map(([label, value]) => (
            <GlassCard key={label} style={styles.kpi}>
              <Text style={styles.kpiValue}>{value}</Text>
              <Text style={styles.kpiLabel}>{label}</Text>
            </GlassCard>
          ))}
        </View>

        <GlassCard>
          <Text style={styles.sectionTitle}>Report Preview</Text>
          {rows.length ? (
            rows.slice(0, 30).map((row, index) => (
              <View key={`${index}-${row._id || row.title || row["Work Type"]}`} style={styles.row}>
                <Text style={styles.rowTitle}>{row.title || row["Work Type"] || row.Category || row.module || "Report Row"}</Text>
                <Text style={styles.meta}>{row.status || row.Status || row.createdAt || row.Date || "-"}</Text>
              </View>
            ))
          ) : (
            <EmptyState title="No report rows" message="Generate a report to preview data." />
          )}
        </GlassCard>
      </ScrollView>
      <Loader visible={busy} title="Please uploading..." message="Generating report..." />
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingBottom: 130, gap: 16 },
  sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: "900", marginBottom: 10 },
  label: { color: theme.colors.muted, marginTop: 10, marginBottom: 4, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  generate: { marginTop: 14, borderRadius: 16, backgroundColor: "rgba(34,211,238,0.22)", padding: 14, alignItems: "center" },
  generateText: { color: theme.colors.text, fontWeight: "900" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: { width: "48%" },
  kpiValue: { color: theme.colors.text, fontSize: 28, fontWeight: "900" },
  kpiLabel: { color: theme.colors.muted, marginTop: 4 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  rowTitle: { color: theme.colors.text, fontWeight: "800" },
  meta: { color: theme.colors.muted, marginTop: 4, fontSize: 12 }
});

export default ReportsScreen;
