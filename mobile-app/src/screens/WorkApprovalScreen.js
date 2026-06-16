import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import AppHeader from "../components/AppHeader";
import ChipSelect from "../components/ChipSelect";
import EmptyState from "../components/EmptyState";
import FormField from "../components/FormField";
import GlassCard from "../components/GlassCard";
import Loader from "../components/Loader";
import MediaModal from "../components/MediaModal";
import Screen from "../components/Screen";
import StatusChip from "../components/StatusChip";
import { parseApiError } from "../api/client";
import { workService } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { useNetwork } from "../context/NetworkContext";
import { getJson, setJson, storageKeys } from "../utils/storage";
import { canManage } from "../utils/permissions";
import { getMediaUrl } from "../utils/media";
import { gradients, theme } from "../theme";
import { LinearGradient } from "expo-linear-gradient";

const workTypes = ["Road Work", "Lights Changing", "Height Work", "Grass Cutting", "Watering Plants", "Plaza Maintenance"];
const statuses = ["All", "Pending", "Approved", "Rejected", "Completed"];

const initialForm = {
  workType: "Road Work",
  plaza: "",
  location: "",
  chainage: "",
  workersCount: "",
  reportedBy: ""
};

const pickImage = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permission required", "Please allow photo access to select evidence.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.82
  });
  if (result.canceled) return null;
  return result.assets?.[0] || null;
};

const WorkApprovalScreen = () => {
  const { user } = useAuth();
  const { online } = useNetwork();
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [beforeImage, setBeforeImage] = useState(null);
  const [afterImages, setAfterImages] = useState({});
  const [filter, setFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState("");
  const [media, setMedia] = useState(null);
  const manager = canManage(user);

  const load = async () => {
    setRefreshing(true);
    try {
      const response = await workService.list();
      const list = response.records || [];
      setRecords(list);
      await setJson(storageKeys.workCache, list);
    } catch (_error) {
      const cached = await getJson(storageKeys.workCache, []);
      setRecords(cached);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "All") return records;
    return records.filter((item) => (item.status || "Pending") === filter);
  }, [records, filter]);

  const submit = async () => {
    if (!online) {
      Alert.alert("Internet connection required to submit");
      return;
    }
    if (!form.workType || !form.location || !form.chainage || !form.workersCount || !beforeImage) {
      Alert.alert("Please fill required fields", "Work Type, Location, Chainage, Workers Count, and Before Image are required.");
      return;
    }
    setBusy(true);
    setBusyMessage("Submitting work approval...");
    try {
      await workService.create({
        ...form,
        title: `${form.workType} - ${form.location}`,
        category: "General",
        priority: "Medium",
        beforeImage
      });
      setForm(initialForm);
      setBeforeImage(null);
      Alert.alert("Success", "Work Approval Submitted Successfully");
      await load();
    } catch (error) {
      Alert.alert("Submit failed", parseApiError(error, "Unable to submit work approval."));
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (record, status) => {
    if (!online) return Alert.alert("Internet connection required to submit");
    if (record.status === "Completed") return Alert.alert("Completed work is locked");
    setBusy(true);
    setBusyMessage(`Updating work to ${status}...`);
    try {
      await workService.updateStatus(record._id, status, user?.name || "Admin");
      await load();
    } catch (error) {
      Alert.alert("Status failed", parseApiError(error, "Unable to update status."));
    } finally {
      setBusy(false);
    }
  };

  const completeWork = async (record) => {
    const image = afterImages[record._id];
    if (!image) return Alert.alert("Please upload after image", "After Work image is required to complete this work.");
    setBusy(true);
    setBusyMessage("Uploading after image...");
    try {
      await workService.uploadAfterImages(record._id, image);
      await workService.updateStatus(record._id, "Completed", user?.name || "Admin");
      setAfterImages((prev) => ({ ...prev, [record._id]: null }));
      await load();
    } catch (error) {
      Alert.alert("Upload failed", parseApiError(error, "Unable to upload completion image."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll={false}>
      <AppHeader title="UTPL Safety HSE" subtitle="Work Approval Center" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={theme.colors.accent} refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={styles.scroll}
      >
        <GlassCard style={styles.formCard}>
          <Text style={styles.sectionTitle}>Submit Work Approval</Text>
          <ChipSelect options={workTypes} value={form.workType} onChange={(workType) => setForm((prev) => ({ ...prev, workType }))} />
          <FormField label="Location / Plaza" value={form.location} onChangeText={(location) => setForm((prev) => ({ ...prev, location }))} placeholder="Location" />
          <FormField label="Chainage / Area" value={form.chainage} onChangeText={(chainage) => setForm((prev) => ({ ...prev, chainage }))} placeholder="Chainage" />
          <FormField label="Workers Count" keyboardType="numeric" value={form.workersCount} onChangeText={(workersCount) => setForm((prev) => ({ ...prev, workersCount }))} placeholder="Workers count" />
          <FormField label="Reported By" value={form.reportedBy} onChangeText={(reportedBy) => setForm((prev) => ({ ...prev, reportedBy }))} placeholder={user?.name || "Reported by"} />
          <TouchableOpacity style={styles.mediaButton} onPress={async () => setBeforeImage(await pickImage())}>
            <Text style={styles.mediaButtonText}>{beforeImage ? "Change Before Image" : "Pick Before Image"}</Text>
          </TouchableOpacity>
          {beforeImage ? <Image source={{ uri: beforeImage.uri }} style={styles.preview} /> : null}
          <TouchableOpacity style={styles.submit} onPress={submit} disabled={busy}>
            <LinearGradient colors={gradients.teal} style={styles.submitBg}>
              <Text style={styles.submitText}>{busy ? "Uploading..." : "Submit Work"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </GlassCard>

        <GlassCard style={styles.listCard}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Work List</Text>
          </View>
          <ChipSelect options={statuses} value={filter} onChange={setFilter} />
          {filtered.length ? (
            filtered.map((record) => {
              const before = getMediaUrl(record.beforeImages?.[0] || record.beforeImage);
              const after = getMediaUrl(record.afterImages?.[0] || record.afterImage);
              return (
                <View key={record._id} style={styles.record}>
                  <Text style={styles.recordTitle}>{record.workType || record.title}</Text>
                  <Text style={styles.meta}>{record.location} | {record.chainage || record.chainageNo}</Text>
                  <Text style={styles.meta}>Workers: {record.workersCount || "-"}</Text>
                  <StatusChip status={record.status || "Pending"} compact />
                  <View style={styles.imageGrid}>
                    <TouchableOpacity style={styles.imageBox} onPress={() => before && setMedia(before)}>
                      {before ? <Image source={{ uri: before }} style={styles.thumb} resizeMode="cover" /> : <Text style={styles.emptyImage}>Before Image</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imageBox} onPress={() => after && setMedia(after)}>
                      {after ? <Image source={{ uri: after }} style={styles.thumb} resizeMode="cover" /> : <Text style={styles.emptyImage}>After Image</Text>}
                    </TouchableOpacity>
                  </View>
                  {manager && record.status !== "Completed" ? (
                    <View style={styles.actions}>
                      {["Approved", "Rejected"].map((status) => (
                        <TouchableOpacity key={status} style={styles.actionButton} onPress={() => updateStatus(record, status)}>
                          <Text style={styles.actionText}>{status}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                  {manager && record.status === "Approved" ? (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={styles.mediaButtonMini}
                        onPress={async () => {
                          const selected = await pickImage();
                          setAfterImages((prev) => ({ ...prev, [record._id]: selected }));
                        }}
                      >
                        <Text style={styles.actionText}>{afterImages[record._id] ? "Change After Image" : "Pick After Image"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.completeButton} onPress={() => completeWork(record)}>
                        <Text style={styles.actionText}>Complete</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <EmptyState title="No work records" message="Submit a work approval or pull to refresh." />
          )}
        </GlassCard>
      </ScrollView>
      <MediaModal visible={Boolean(media)} media={media} onClose={() => setMedia(null)} />
      <Loader visible={busy} title="Please uploading..." message={busyMessage} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingBottom: 130, gap: 16 },
  formCard: { marginBottom: 16 },
  listCard: { marginBottom: 20 },
  sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: "900", marginBottom: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mediaButton: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, padding: 13, marginTop: 12, alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  mediaButtonMini: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "rgba(34,211,238,0.14)" },
  mediaButtonText: { color: theme.colors.text, fontWeight: "800" },
  preview: { height: 150, borderRadius: 16, marginTop: 12, backgroundColor: "#020617" },
  submit: { borderRadius: 18, overflow: "hidden", marginTop: 14 },
  submitBg: { minHeight: 50, alignItems: "center", justifyContent: "center" },
  submitText: { color: theme.colors.text, fontWeight: "900" },
  record: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 20, padding: 14, marginTop: 12, backgroundColor: "rgba(255,255,255,0.045)" },
  recordTitle: { color: theme.colors.text, fontWeight: "900", fontSize: 16 },
  meta: { color: theme.colors.muted, marginTop: 4, fontSize: 12 },
  imageGrid: { flexDirection: "row", gap: 10, marginTop: 12 },
  imageBox: { flex: 1, height: 118, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: theme.colors.border, alignItems: "center", justifyContent: "center", backgroundColor: "#020617" },
  thumb: { width: "100%", height: "100%" },
  emptyImage: { color: theme.colors.dim, fontSize: 11 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  actionButton: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: theme.colors.border },
  completeButton: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(34,197,94,0.22)" },
  actionText: { color: theme.colors.text, fontWeight: "800", fontSize: 12 }
});

export default WorkApprovalScreen;
