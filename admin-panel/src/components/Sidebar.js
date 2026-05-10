import {
  LayoutDashboard,
  ClipboardList,
  AlertTriangle,
  GraduationCap,
  CheckCircle,
  UserPlus,
  BarChart3,
  Settings
} from 'lucide-react';
import { motion } from "framer-motion";
import { useState } from "react";

function Sidebar({ setPage }) {
  const role = localStorage.getItem("role");
  const [active, setActive] = useState("dashboard");

  const handleClick = (page) => {
    setActive(page);
    setPage(page);
  };

  return (
    <div className="w-64 h-screen fixed left-0 top-0 text-white p-5">

      {/* 🌌 BACKGROUND */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617] via-[#0f172a] to-black -z-10" />

      {/* GLOW EFFECT */}
      <div className="absolute w-[250px] h-[250px] bg-cyan-500 blur-[120px] opacity-20 top-0 left-0" />
      <div className="absolute w-[200px] h-[200px] bg-purple-500 blur-[100px] opacity-10 bottom-0 right-0" />

      {/* LOGO */}
      <motion.h2 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-2xl font-bold mb-10 text-cyan-400 tracking-wide"
      >
        🚧 Safety App
      </motion.h2>

      {/* MENU */}
      <div className="space-y-2">

        {/* COMMON */}
        <Menu icon={<LayoutDashboard />} text="Dashboard"
          active={active === "dashboard"}
          onClick={() => handleClick('dashboard')} />

        <Menu icon={<ClipboardList />} text="Work Approval"
          active={active === "work"}
          onClick={() => handleClick('work')} />

        <Menu icon={<AlertTriangle />} text="Hazards"
          active={active === "hazard"}
          onClick={() => handleClick('hazard')} />

        <Menu icon={<GraduationCap />} text="Training"
          active={active === "training"}
          onClick={() => handleClick('training')} />

        {/* ADMIN ONLY */}
        {role === "admin" && (
          <>
            <div className="border-t border-white/10 my-4"></div>

            <p className="text-xs text-gray-400 mb-2 px-2">ADMIN</p>

            <Menu icon={<BarChart3 />} text="Reports"
              active={active === "reports"}
              onClick={() => handleClick('reports')} />

            <Menu icon={<UserPlus />} text="Users"
              active={active === "users"}
              onClick={() => handleClick('users')} />

            <Menu icon={<CheckCircle />} text="Work Admin"
              active={active === "workAdmin"}
              onClick={() => handleClick('workAdmin')} />

            <Menu icon={<Settings />} text="Settings"
              active={active === "settings"}
              onClick={() => handleClick('settings')} />
          </>
        )}

      </div>
    </div>
  );
}

function Menu({ icon, text, onClick, active }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition relative overflow-hidden
      ${active 
        ? "bg-cyan-500/10 border border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)]" 
        : "hover:bg-white/5"}`}
    >

      {/* ACTIVE GLOW */}
      {active && (
        <div className="absolute inset-0 bg-cyan-400/10 blur-xl"></div>
      )}

      <div className={`text-lg ${active ? "text-cyan-400" : "text-gray-300"}`}>
        {icon}
      </div>

      <span className={`text-sm font-medium ${active ? "text-white" : "text-gray-400"}`}>
        {text}
      </span>

    </motion.div>
  );
}

export default Sidebar;