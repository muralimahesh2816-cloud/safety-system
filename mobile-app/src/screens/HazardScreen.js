import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
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
import { hazardService } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { useNetwork } from "../context/NetworkContext";
import { canManage } from "../utils/permissions";
import { getMediaUrl } from "../utils/media";
import { getJson, setJson, storageKeys } from "../utils/storage";
import { gradients, theme } from "../theme";

const plazas = ["Sasthan Plaza", "Hejamadi Plaza", "Talapady Plaza", "Site"];
const categories = ["Hazard", "Near Miss"];
const teams = ["Maintenance Team", "Operation Team", "Kent Team", "Electrician Team", "RP Team", "Paramedical Team", "IT Team", "Housekeeping Team"];
const filters = ["All", "Open", "Closed"];

const initialForm = {
  date: new Date().toISOString().slice(0, 10),
  plaza: "Sasthan Plaza",
  location: "",
  reportedBy: "",
  category: "Hazard",
  action: "Maintenance Team",
  severity: "Medium",
  likelihood: "Possible"
};

const pickImage = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.82 });
  if (result.canceled) return null;
  return result.assets?.[0] || null;
};

const HazardScreen = () => {
  const { user } = useAuth();
  const { online } = useNetwork();
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [evidenceImage, setEvidenceImage] = useState(null);
  const [closureImages, setClosureImages] = useState({});
  const [filter, setFilter] = useState("All");
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState("");
  const [media, setMedia] = useState(null);
  const manager = canManage(user);

  const load = async () => {
    setRefreshing(true);
    try {
      const response = await hazardService.list();
      const list = response.records || [];
      setRecords(list);
      await setJson(storageKeys.hazardCache, list);
    } catch (_error) {
      setRecords(await getJson(storageKeys.hazardCache, []));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "All") return records;
    return records.filter((item) => (item.status || "Open") === filter);
  }, [records, filter]);

  const submit = async () => {
    if (!online) return Alert.alert("Internet connection required to submit");
    if (!form.location || !form.reportedBy || !form.category || !form.action || !evidenceImage) {
      Alert.alert("Please fill required fields", "Location, Reported By, Category, Action Team, and Evidence Image are required.");
      return;
    }
    setBusy(true);
    setBusyMessage("Submitting hazard report...");
    try {
      await hazardService.create({
        ...form,
        title: `${form.category} - ${form.plaza}`,
        description: `${form.category} reported at ${form.location}`,
        evidenceImage
      });
      setForm(initialForm);
      setEvidenceImage(null);
      Alert.alert("Success", "Hazard Submitted Successfully");
      await load();
    } catch (error) {
      Alert.alert("Submit failed", parseApiError(error, "Unable to submit hazard."));
    } finally {
      setBusy(false);
    }
  };

  const closeHazard = async (record) => {
    const image = closureImages[record._id];
    if (!image) return Alert.alert("Please upload closure image", "Closure image is required to close this hazard.");
    setBusy(true);
    setBusyMessage("Uploading closure image...");
    try {
      await hazardService.close(record._id, image);
      setClosureImages((prev) => ({ ...prev, [record._id]: null }));
      Alert.alert("Success", "Hazard Closed Successfully");
      await load();
    } catch (error) {
      Alert.alert("Closure failed", parseApiError(error, "Unable to close hazard."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll={false}>
      <AppHeader title="UTPL Safety HSE" subtitle="Hazard Control Hub" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={theme.colors.accent} refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={styles.scroll}
      >
        <GlassCard>
          <Text style={styles.sectionTitle}>Report Hazard</Text>
          <ChipSelect options={plazas} value={form.plaza} onChange={(plaza) => setForm((prev) => ({ ...prev, plaza }))} />
          <ChipSelect options={categories} value={form.category} onChange={(category) => setForm((prev) => ({ ...prev, category }))} />
          <ChipSelect options={teams} value={form.action} onChange={(action) => setForm((prev) => ({ ...prev, action }))} />
          <FormField label="Location / Chainage" value={form.location} onChangeText={(location) => setForm((prev) => ({ ...prev, location }))} placeholder="Location" />
          <FormField label="Reported By" value={form.reportedBy} onChangeText={(reportedBy) => setForm((prev) => ({ ...prev, reportedBy }))} placeholder={user?.name || "Reported by"} />
          <TouchableOpacity style={styles.mediaButton} onPress={async () => setEvidenceImage(await pickImage())}>
            <Text style={styles.mediaButtonText}>{evidenceImage ? "Change Evidence Image" : "Pick Evidence Image"}</Text>
          </TouchableOpacity>
          {evidenceImage ? <Image source={{ uri: evidenceImage.uri }} style={styles.preview} /> : null}
          <TouchableOpacity style={styles.submit} onPress={submit} disabled={busy}>
            <LinearGradient colors={gradients.amber} style={styles.submitBg}>
              <Text style={styles.submitText}>{busy ? "Uploading..." : "Submit Hazard"}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </GlassCard>

        <GlassCard style={styles.listCard}>
          <Text style={styles.sectionTitle}>Hazard Log</Text>
          <ChipSelect options={filters} value={filter} onChange={setFilter} />
          {filtered.length ? (
            filtered.map((record) => {
              const evidence = getMediaUrl(record.evidenceImages?.[0] || record.beforeImage);
              const closure = getMediaUrl(record.closureImages?.[0] || record.afterImage);
              return (
                <View key={record._id} style={styles.record}>
                  <Text style={styles.recordTitle}>{record.category || record.title}</Text>
                  <Text style={styles.meta}>{record.plaza} | {record.location}</Text>
                  <Text style={styles.meta}>Team: {record.action || "-"}</Text>
                  <StatusChip status={record.status || "Open"} compact />
                  <View style={styles.imageGrid}>
                    <TouchableOpacity style={styles.imageBox} onPress={() => evidence && setMedia(evidence)}>
                      {evidence ? <Image source={{ uri: evidence }} style={styles.thumb} resizeMode="cover" /> : <Text style={styles.emptyImage}>Evidence</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.imageBox} onPress={() => closure && setMedia(closure)}>
                      {closure ? <Image source={{ uri: closure }} style={styles.thumb} resizeMode="cover" /> : <Text style={styles.emptyImage}>Closure</Text>}
                    </TouchableOpacity>
                  </View>
                  {manager && (record.status || "Open") === "Open" ? (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={styles.mediaButtonMini}
                        onPress={async () => {
                          const selected = await pickImage();
                          setClosureImages((prev) => ({ ...prev, [record._id]: selected }));
                        }}
                      >
                        <Text style={styles.actionText}>{closureImages[record._id] ? "Change Closure Image" : "Pick Closure Image"}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.closeButton} onPress={() => closeHazard(record)}>
                        <Text style={styles.actionText}>Close Hazard</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
              );
            })
          ) : (
            <EmptyState title="No hazards found" message="Submit a hazard or pull to refresh." />
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
  listCard: { marginBottom: 20 },
  sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: "900", marginBottom: 10 },
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
  closeButton: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(34,197,94,0.22)" },
  actionText: { color: theme.colors.text, fontWeight: "800", fontSize: 12 }
});

export default HazardScreen;
