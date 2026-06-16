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
import VideoPlayer from "../components/VideoPlayer";
import { parseApiError } from "../api/client";
import { trainingService } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { useNetwork } from "../context/NetworkContext";
import { canAdmin } from "../utils/permissions";
import { getMediaUrl } from "../utils/media";
import { getJson, setJson, storageKeys } from "../utils/storage";
import { gradients, theme } from "../theme";

const baseCategories = ["All", "General", "PPE", "Electrical", "Fire Safety", "Road Safety"];
const initialForm = { title: "", category: "General", description: "" };

const pickMedia = async (kind) => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("Permission required", "Please allow media access.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: kind === "video" ? ["videos"] : ["images"],
    quality: 0.82
  });
  if (result.canceled) return null;
  return result.assets?.[0] || null;
};

const TrainingScreen = () => {
  const { user } = useAuth();
  const { online } = useNetwork();
  const [records, setRecords] = useState([]);
  const [history, setHistory] = useState([]);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [video, setVideo] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState(null);
  const admin = canAdmin(user);

  const load = async () => {
    setRefreshing(true);
    try {
      const [listRes, historyRes] = await Promise.all([trainingService.list(), trainingService.history().catch(() => ({ history: [] }))]);
      const list = listRes.records || [];
      setRecords(list);
      setHistory(historyRes.history || []);
      setActive((current) => (current && list.some((item) => item._id === current._id) ? current : list[0] || null));
      await setJson(storageKeys.trainingCache, { records: list, history: historyRes.history || [] });
    } catch (_error) {
      const cached = await getJson(storageKeys.trainingCache, { records: [], history: [] });
      setRecords(cached.records || []);
      setHistory(cached.history || []);
      setActive((current) =>
        current && cached.records?.some((item) => item._id === current._id) ? current : cached.records?.[0] || null
      );
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(baseCategories);
    records.forEach((item) => item.category && set.add(item.category));
    return Array.from(set);
  }, [records]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((item) => {
      const matchesCategory = category === "All" || item.category === category;
      const searchable = `${item.title || ""} ${item.description || ""} ${item.category || ""}`.toLowerCase();
      return matchesCategory && (!needle || searchable.includes(needle));
    });
  }, [category, query, records]);

  const submit = async () => {
    if (!online) return Alert.alert("Internet connection required to submit");
    if (!form.title || !form.description || !form.category || !video) {
      Alert.alert("Please fill required fields", "Title, category, description, and video are required.");
      return;
    }
    setBusy(true);
    try {
      await trainingService.create({ ...form, video, thumbnail, durationMinutes: 1 });
      setForm(initialForm);
      setVideo(null);
      setThumbnail(null);
      Alert.alert("Success", "Training Added Successfully");
      await load();
    } catch (error) {
      Alert.alert("Upload failed", parseApiError(error, "Unable to upload training."));
    } finally {
      setBusy(false);
    }
  };

  const openAndComplete = async (record) => {
    const url = getMediaUrl(record.video?.url || record.video);
    if (!url) return;
    setMedia({ url, type: "video" });
    try {
      await trainingService.progress(record._id, 100, 120);
    } catch (_error) {
      // Progress is best-effort for legacy permissions.
    }
  };

  const deleteTraining = (record) => {
    Alert.alert("Delete training?", `Remove ${record.title || "this training"} from the Training Center.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await trainingService.remove(record._id);
            Alert.alert("Deleted", "Training concept deleted successfully.");
            if (active?._id === record._id) setActive(null);
            await load();
          } catch (error) {
            Alert.alert("Delete failed", parseApiError(error, "Unable to delete training."));
          } finally {
            setBusy(false);
          }
        }
      }
    ]);
  };

  const activeVideo = getMediaUrl(active?.video?.url || active?.video);
  const activeImage = getMediaUrl(active?.thumbnail?.url || active?.thumbnail || active?.banner);

  return (
    <Screen scroll={false}>
      <AppHeader title="UTPL Safety HSE" subtitle="Training Streaming Portal" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={theme.colors.accent} refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={styles.scroll}
      >
        <ChipSelect options={categories} value={category} onChange={setCategory} />
        <FormField
          value={query}
          onChangeText={setQuery}
          placeholder="Search training, PPE, road safety..."
          autoCorrect={false}
          style={styles.search}
        />

        {active ? (
          <GlassCard style={styles.hero} strong>
            <TouchableOpacity onPress={() => openAndComplete(active)} style={styles.heroButton}>
              {activeVideo ? (
                <VideoPlayer key={activeVideo} source={activeVideo} autoPlay loop muted controls={false} contentFit="cover" style={styles.heroMedia} />
              ) : activeImage ? (
                <Image source={{ uri: activeImage }} style={styles.heroMedia} />
              ) : null}
              <LinearGradient colors={["rgba(2,6,23,0.12)", "rgba(2,6,23,0.94)"]} style={styles.heroOverlay}>
                <Text style={styles.heroCategory}>{active.category || "General"}</Text>
                <Text style={styles.heroTitle}>{active.title}</Text>
                <Text style={styles.heroText}>{active.description}</Text>
                <View style={styles.watchButton}>
                  <Text style={styles.watch}>Watch Now</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </GlassCard>
        ) : null}

        <GlassCard>
          <Text style={styles.sectionTitle}>Training Concepts</Text>
          {filtered.length ? (
            filtered.map((record) => {
              const image = getMediaUrl(record.thumbnail?.url || record.thumbnail || record.banner);
              const progress = history.find((item) => (item.id || item.trainingId) === record._id)?.progress || 0;
              return (
                <TouchableOpacity key={record._id} style={styles.row} onPress={() => setActive(record)}>
                  {image ? <Image source={{ uri: image }} style={styles.rowImage} resizeMode="cover" /> : <View style={styles.rowImage} />}
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{record.title}</Text>
                    <Text style={styles.meta}>{record.category || "General"} | {progress}% complete</Text>
                    <Text style={styles.description} numberOfLines={2}>{record.description}</Text>
                  </View>
                  <View style={styles.rowActions}>
                    <TouchableOpacity style={styles.playButton} onPress={() => openAndComplete(record)}>
                      <Text style={styles.playText}>Play</Text>
                    </TouchableOpacity>
                    {admin ? (
                      <TouchableOpacity style={styles.deleteButton} onPress={() => deleteTraining(record)}>
                        <Text style={styles.deleteText}>Delete</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <EmptyState title="No training modules" message="Training videos will appear here." />
          )}
        </GlassCard>

        {admin ? (
          <GlassCard>
            <Text style={styles.sectionTitle}>Upload New Training</Text>
            <FormField label="Title" value={form.title} onChangeText={(title) => setForm((prev) => ({ ...prev, title }))} placeholder="Training title" />
            <ChipSelect options={categories.filter((item) => item !== "All")} value={form.category} onChange={(nextCategory) => setForm((prev) => ({ ...prev, category: nextCategory }))} />
            <FormField label="Description" value={form.description} onChangeText={(description) => setForm((prev) => ({ ...prev, description }))} placeholder="Training description" multiline />
            <View style={styles.actions}>
              <TouchableOpacity style={styles.mediaButton} onPress={async () => setThumbnail(await pickMedia("image"))}>
                <Text style={styles.actionText}>{thumbnail ? "Change Thumbnail" : "Pick Thumbnail"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaButton} onPress={async () => setVideo(await pickMedia("video"))}>
                <Text style={styles.actionText}>{video ? "Change Video" : "Pick Video"}</Text>
              </TouchableOpacity>
            </View>
            {thumbnail ? <Image source={{ uri: thumbnail.uri }} style={styles.previewImage} resizeMode="cover" /> : null}
            {video ? <VideoPlayer key={video.uri} source={video.uri} controls contentFit="contain" style={styles.previewVideo} /> : null}
            <TouchableOpacity style={styles.submit} onPress={submit} disabled={busy}>
              <LinearGradient colors={gradients.teal} style={styles.submitBg}>
                <Text style={styles.submitText}>{busy ? "Uploading..." : "Upload Training"}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </GlassCard>
        ) : null}
      </ScrollView>
      <MediaModal visible={Boolean(media)} media={media} onClose={() => setMedia(null)} />
      <Loader visible={busy} title="Please uploading..." message="Uploading training video..." />
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingBottom: 130, gap: 16 },
  search: { marginTop: 4 },
  hero: { padding: 0, marginTop: 12 },
  heroButton: { minHeight: 360, overflow: "hidden", borderRadius: 24 },
  heroMedia: { width: "100%", height: 360, backgroundColor: "#020617" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", padding: 18 },
  heroCategory: { color: theme.colors.accent2, fontWeight: "900", fontSize: 12 },
  heroTitle: { color: theme.colors.text, fontSize: 27, fontWeight: "900", marginTop: 6 },
  heroText: { color: theme.colors.text, marginTop: 8, lineHeight: 20 },
  watchButton: { alignSelf: "flex-start", borderRadius: 16, backgroundColor: "rgba(34,211,238,0.18)", borderWidth: 1, borderColor: "rgba(34,211,238,0.38)", marginTop: 14, paddingHorizontal: 14, paddingVertical: 9 },
  watch: { color: theme.colors.text, fontWeight: "900" },
  sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: "900", marginBottom: 10 },
  row: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  rowImage: { width: 92, height: 92, borderRadius: 18, backgroundColor: "#020617" },
  rowCopy: { flex: 1 },
  rowTitle: { color: theme.colors.text, fontWeight: "900" },
  meta: { color: theme.colors.accent2, fontSize: 11, marginTop: 4 },
  description: { color: theme.colors.muted, fontSize: 12, marginTop: 4 },
  rowActions: { alignSelf: "center", gap: 8 },
  playButton: { alignSelf: "center", borderRadius: 14, backgroundColor: "rgba(34,211,238,0.16)", paddingHorizontal: 12, paddingVertical: 9 },
  playText: { color: theme.colors.text, fontWeight: "900" },
  deleteButton: { alignSelf: "center", borderRadius: 14, backgroundColor: "rgba(251,113,133,0.16)", paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(251,113,133,0.34)" },
  deleteText: { color: theme.colors.danger, fontWeight: "900", fontSize: 12 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  mediaButton: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, padding: 12, alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  actionText: { color: theme.colors.text, fontWeight: "800", fontSize: 12 },
  previewImage: { height: 140, borderRadius: 16, marginTop: 12, backgroundColor: "#020617" },
  previewVideo: { height: 170, borderRadius: 16, marginTop: 12, backgroundColor: "#020617" },
  submit: { borderRadius: 18, overflow: "hidden", marginTop: 14 },
  submitBg: { minHeight: 50, alignItems: "center", justifyContent: "center" },
  submitText: { color: theme.colors.text, fontWeight: "900" }
});

export default TrainingScreen;
