import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { hazardService, workService } from "../api/services";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from "recharts";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

function DashboardNew({ setPage }) {

  const [work, setWork] =
    useState([]);

  const [hazard, setHazard] =
    useState([]);

  // ================= FETCH =================

  useEffect(() => {

    fetchAll();

    const interval =
      setInterval(() => {

        fetchAll();

      }, 5000);

    return () =>
      clearInterval(interval);

  }, []);

  const fetchAll =
    async () => {

      try {

const [workRes, hazardRes] = await Promise.all([
  workService.list(),
  hazardService.list()
]);

        setWork(
          workRes.records || []
        );

        setHazard(
          hazardRes.records || []
        );

      } catch (err) {

        console.log(err);

      }

    };

  // ================= WORK STATS =================

  const totalWork =
    work.length;

  const pendingWork =
    work.filter(
      i =>
        i.status ===
        "Pending"
    ).length;

  const approvedWork =
    work.filter(
      i =>
        i.status ===
        "Approved"
    ).length;

  const completedWork =
    work.filter(
      i =>
        i.status ===
        "Completed"
    ).length;

  // ================= HAZARD STATS =================

  const totalHazards =
    hazard.length;

  const openHazards =
    hazard.filter(
      i =>
        i.status ===
        "Open"
    ).length;

  const closedHazards =
    hazard.filter(
      i =>
        i.status ===
        "Closed"
    ).length;

  // ================= CHART DATA =================

  const workChartData = [

    {
      name: "Pending",
      value: pendingWork
    },

    {
      name: "Approved",
      value: approvedWork
    },

    {
      name: "Completed",
      value: completedWork
    }

  ];

  const hazardChartData = [

    {
      name: "Open",
      value: openHazards
    },

    {
      name: "Closed",
      value: closedHazards
    }

  ];

  // ================= COLORS =================

  const COLORS = [

    "#facc15",

    "#22c55e",

    "#06b6d4"

  ];

  // ================= EXPORT =================

  const exportExcel =
    () => {

      const ws =
        XLSX.utils
          .json_to_sheet([

            ...work,

            ...hazard

          ]);

      const wb =
        XLSX.utils
          .book_new();

      XLSX.utils
        .book_append_sheet(

          wb,

          ws,

          "Safety Report"

        );

      const file =
        XLSX.write(

          wb,

          {

            bookType:
              "xlsx",

            type:
              "array"

          }

        );

      saveAs(

        new Blob([file]),

        "Safety_Report.xlsx"

      );

    };

  // ================= LIVE ACTIVITIES =================

  const activities = [

    ...work.map(item => ({

      title:
        `${item.workType} Work`,

      sub:
        `${item.status || "Pending"} at ${item.location}`,

      type: "work",

      time:
        item.createdAt

    })),

    ...hazard.map(item => ({

      title:
        `${item.hazardType || "Hazard"} Hazard`,

      sub:
        `${item.status || "Open"} at ${item.location}`,

      type: "hazard",

      time:
        item.createdAt

    }))

  ]

  .sort((a, b) =>
    new Date(b.time) -
    new Date(a.time)
  )

  .slice(0, 8);

  return (

    <div className="min-h-screen text-white relative overflow-hidden p-6">

      {/* BACKGROUND */}

      <div className="fixed inset-0 bg-[#020617] -z-20" />

      <div className="fixed top-[-150px] left-[-150px] w-[350px] h-[350px] bg-cyan-500 opacity-20 blur-[120px] rounded-full animate-pulse -z-10" />

      <div className="fixed bottom-[-150px] right-[-150px] w-[350px] h-[350px] bg-purple-500 opacity-20 blur-[120px] rounded-full animate-pulse -z-10" />

      {/* HEADER */}

      <div className="flex justify-between items-center mb-8">

        <div>

          <h1 className="text-5xl font-black">

            🚀 Safety HSE

          </h1>

          <p className="text-gray-400 mt-2">

            Live Monitoring Dashboard

          </p>

        </div>

        <button

          onClick={exportExcel}

          className="bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-3 rounded-2xl font-bold shadow-2xl hover:scale-105 transition"

        >

          📁 Export Report

        </button>

      </div>

      {/* HERO */}

      <motion.div

        initial={{
          opacity: 0,
          y: 30
        }}

        animate={{
          opacity: 1,
          y: 0
        }}

        className="relative h-[320px] rounded-[40px] overflow-hidden bg-gradient-to-r from-cyan-500/20 to-blue-600/20 border border-white/10 backdrop-blur-2xl p-10 flex flex-col justify-end shadow-[0_0_80px_rgba(0,255,255,0.08)]"

      >

        <div className="absolute inset-0 bg-black/20" />

        <div className="relative z-10">

          <p className="text-cyan-400 font-bold mb-4 tracking-widest">

            ● LIVE OPERATIONS

          </p>

          <h2 className="text-6xl font-black leading-tight w-[70%]">

            Safety Monitoring & Operations Control

          </h2>

          <p className="text-gray-300 mt-4 w-[60%] text-lg">

            Work approvals, hazard tracking, safety training and live reporting in one premium system.

          </p>

        </div>

      </motion.div>

      {/* WORK COUNTS */}

      <h2 className="text-3xl font-bold mt-10 mb-5">

        🛠 Work Approval Statistics

      </h2>

      <div className="grid md:grid-cols-4 gap-5">

        <PremiumCard
          title="Total Work"
          value={totalWork}
          color="cyan"
          icon="🛠"
        />

        <PremiumCard
          title="Pending"
          value={pendingWork}
          color="yellow"
          icon="⏳"
        />

        <PremiumCard
          title="Approved"
          value={approvedWork}
          color="green"
          icon="✅"
        />

        <PremiumCard
          title="Completed"
          value={completedWork}
          color="blue"
          icon="📌"
        />

      </div>

      {/* HAZARD COUNTS */}

      <h2 className="text-3xl font-bold mt-10 mb-5">

        ⚠ Hazard Statistics

      </h2>

      <div className="grid md:grid-cols-3 gap-5">

        <PremiumCard
          title="Total Hazards"
          value={totalHazards}
          color="red"
          icon="⚠"
        />

        <PremiumCard
          title="Open"
          value={openHazards}
          color="orange"
          icon="🚨"
        />

        <PremiumCard
          title="Closed"
          value={closedHazards}
          color="green"
          icon="✔"
        />

      </div>

      {/* CHARTS */}

      <div className="grid md:grid-cols-2 gap-6 mt-10">

        {/* WORK */}

        <GlassCard>

          <h3 className="text-2xl font-bold mb-5">

            📊 Work Analytics

          </h3>

          <div className="w-full h-[320px] min-h-[320px] min-w-0">

            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>

              <PieChart>

                <Pie

                  data={workChartData}

                  dataKey="value"

                  outerRadius={110}

                  innerRadius={65}

                  paddingAngle={5}

                  label

                >

                  {workChartData.map(
                    (_, i) => (

                      <Cell

                        key={i}

                        fill={
                          COLORS[i]
                        }

                      />

                    )
                  )}

                </Pie>

                <Tooltip />

                <Legend />

              </PieChart>

            </ResponsiveContainer>

          </div>

        </GlassCard>

        {/* HAZARD */}

        <GlassCard>

          <h3 className="text-2xl font-bold mb-5">

            ⚠ Hazard Analytics

          </h3>

          <div className="w-full h-[320px] min-h-[320px] min-w-0">

            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>

              <BarChart
                data={
                  hazardChartData
                }
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#333"
                />

                <XAxis
                  dataKey="name"
                  stroke="#aaa"
                />

                <YAxis
                  stroke="#aaa"
                />

                <Tooltip />

                <Legend />

                <Bar
                  dataKey="value"
                  fill="#06b6d4"
                  radius={[
                    10,
                    10,
                    0,
                    0
                  ]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </GlassCard>

      </div>

      {/* TRENDING */}

      <h2 className="text-3xl font-bold mt-12 mb-5">

        🔥 Trending Modules

      </h2>

      <div className="grid md:grid-cols-3 gap-6">

        <TrendingCard

          title="Work Approval"

          desc="Approve & Manage Work"

          color="from-cyan-500 to-blue-600"

          onClick={() =>
            setPage("work")
          }

        />

        <TrendingCard

          title="Hazard Reporting"

          desc="Live Hazard Tracking"

          color="from-red-500 to-pink-600"

          onClick={() =>
            setPage("hazard")
          }

        />

        <TrendingCard

          title="Training"

          desc="Safety Video Training"

          color="from-green-500 to-emerald-600"

          onClick={() =>
            setPage("training")
          }

        />

      </div>

      {/* LIVE ACTIVITIES */}

      <h2 className="text-3xl font-bold mt-12 mb-5">

        📌 Recent Activities

      </h2>

      <div className="space-y-4">

        {activities.map(
          (item, index) => (

            <ActivityCard

              key={index}

              title={
                item.title
              }

              sub={
                item.sub
              }

              type={
                item.type
              }

            />

          )
        )}

      </div>

      <div className="h-20" />

    </div>

  );

}

// ================= PREMIUM CARD =================

function PremiumCard({
  title,
  value,
  color,
  icon
}) {

  const colors = {

    cyan:
      "from-cyan-500/20 to-blue-500/10",

    yellow:
      "from-yellow-500/20 to-orange-500/10",

    green:
      "from-green-500/20 to-emerald-500/10",

    blue:
      "from-blue-500/20 to-indigo-500/10",

    red:
      "from-red-500/20 to-pink-500/10",

    orange:
      "from-orange-500/20 to-yellow-500/10"

  };

  return (

    <motion.div

      whileHover={{
        scale: 1.05
      }}

      className={`bg-gradient-to-br ${colors[color]} border border-white/10 backdrop-blur-xl rounded-[30px] p-6 shadow-2xl relative overflow-hidden`}

    >

      <div className="absolute right-[-15px] top-[-10px] text-7xl opacity-10">

        {icon}

      </div>

      <p className="text-gray-400">

        {title}

      </p>

      <h2 className="text-4xl font-black mt-3">

        {value}

      </h2>

    </motion.div>

  );

}

// ================= GLASS =================

function GlassCard({
  children
}) {

  return (

    <motion.div

      whileHover={{
        scale: 1.01
      }}

      className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[35px] p-6 shadow-[0_0_50px_rgba(0,0,0,0.25)]"

    >

      {children}

    </motion.div>

  );

}

// ================= TRENDING =================

function TrendingCard({
  title,
  desc,
  color,
  onClick
}) {

  return (

    <motion.div

      whileHover={{
        scale: 1.03
      }}

      onClick={onClick}

      className={`cursor-pointer h-[220px] rounded-[35px] bg-gradient-to-br ${color} p-8 relative overflow-hidden shadow-2xl`}

    >

      <div className="absolute right-[-20px] bottom-[-20px] text-[140px] opacity-10">

        ▶

      </div>

      <div className="relative z-10">

        <h3 className="text-3xl font-black">

          {title}

        </h3>

        <p className="mt-3 text-white/80">

          {desc}

        </p>

      </div>

    </motion.div>

  );

}

// ================= ACTIVITY =================

function ActivityCard({
  title,
  sub,
  type
}) {

  return (

    <motion.div

      whileHover={{
        scale: 1.01
      }}

      className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex items-center gap-4"

    >

      <div className={`w-4 h-4 rounded-full ${
        type === "work"
          ? "bg-cyan-400"
          : "bg-red-400"
      }`} />

      <div>

        <h3 className="font-semibold text-lg">

          {title}

        </h3>

        <p className="text-gray-400">

          {sub}

        </p>

      </div>

    </motion.div>

  );

}

export default DashboardNew;
