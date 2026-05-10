import { useEffect, useState } from "react";

import Login from "./components/Login";
import Sidebar from "./components/Sidebar";

import WorkApproval from "./components/WorkApproval";
import WorkAdmin from "./components/WorkAdmin";
import Hazard from "./components/Hazard";
import Training from "./components/Training";
import Users from "./components/Users";
import Reports from "./components/Reports";
import SettingsPage from "./components/SettingsPage";
import DashboardNew from "./components/DashboardNew";

function App() {

  // ================= USER =================

  const [user, setUser] =
    useState(
      localStorage.getItem("role")
    );

  const [page, setPage] =
    useState("dashboard");

  // ================= SESSION =================

  const [showTimeout, setShowTimeout] =
    useState(false);

  const [countdown, setCountdown] =
    useState(60);

  // ================= LOGIN CHECK =================

  const isLoggedIn =
    localStorage.getItem("token");

  // ================= AUTO LOGOUT =================

  useEffect(() => {

    let inactivityTimer;

    let countdownTimer;

    const resetTimer = () => {

      clearTimeout(inactivityTimer);

      clearInterval(countdownTimer);

      setShowTimeout(false);

      setCountdown(60);

      inactivityTimer =
        setTimeout(() => {

          setShowTimeout(true);

          let timeLeft = 60;

          countdownTimer =
            setInterval(() => {

              timeLeft--;

              setCountdown(timeLeft);

              if (timeLeft <= 0) {

                clearInterval(
                  countdownTimer
                );

                localStorage.clear();

                window.location.reload();

              }

            }, 1000);

        }, 10 * 60 * 1000);

    };

    // EVENTS

    window.addEventListener(
      "mousemove",
      resetTimer
    );

    window.addEventListener(
      "keydown",
      resetTimer
    );

    window.addEventListener(
      "click",
      resetTimer
    );

    window.addEventListener(
      "scroll",
      resetTimer
    );

    resetTimer();

    return () => {

      clearTimeout(inactivityTimer);

      clearInterval(countdownTimer);

      window.removeEventListener(
        "mousemove",
        resetTimer
      );

      window.removeEventListener(
        "keydown",
        resetTimer
      );

      window.removeEventListener(
        "click",
        resetTimer
      );

      window.removeEventListener(
        "scroll",
        resetTimer
      );

    };

  }, []);

  // ================= LOGIN PAGE =================

  if (!user || !isLoggedIn) {

    return (
      <Login setUser={setUser} />
    );

  }

  // ================= MAIN APP =================

  return (

    <div className="flex h-screen overflow-hidden bg-[#020617] text-white">

      {/* SIDEBAR */}

      <div className="w-60 h-screen fixed left-0 top-0 bg-[#020617] border-r border-white/10">

        <Sidebar setPage={setPage} />

      </div>

      {/* MAIN CONTENT */}

      <div className="flex-1 ml-60 h-screen overflow-y-auto p-6">

        {/* HEADER */}

        <div className="flex justify-between items-center mb-2 sticky top-0 bg-[#020617]/90 backdrop-blur-2xl z-20 py-6 px-6 border-b border-white/10">

          {/* LEFT */}

          <div>

            <h2 className="text-3xl font-bold text-cyan-400">

              📊 Safety HSE Management System

            </h2>

            <p className="text-gray-400 mt-1">

              Welcome,
              {" "}
              {localStorage.getItem("name")}

            </p>

          </div>

          {/* RIGHT */}

          <button

            className="bg-red-500 hover:bg-red-600 px-5 py-3 rounded-2xl transition shadow-xl"

            onClick={() => {

              localStorage.clear();

              setUser(null);

            }}

          >

            🚪 Logout

          </button>

        </div>

        {/* PAGES */}

           {page === "dashboard" && (
           <DashboardNew setPage={setPage} />
           )}

        {page === "work" && (
          <WorkApproval />
        )}

        {page === "hazard" && (
          <Hazard />
        )}

        {page === "workAdmin" && (
          <WorkAdmin />
        )}

        {page === "training" && (
          <Training />
        )}

        {page === "users" && (
          <Users />
        )}

        {page === "reports" && (
          <Reports />
        )}

        {page === "settings" && (
          <SettingsPage />
        )}

      </div>

      {/* AUTO LOGOUT POPUP */}

      {showTimeout && (

        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

          <div className="bg-slate-900 border border-red-500/20 rounded-3xl p-8 w-[420px] shadow-2xl text-center">

            <h2 className="text-3xl font-bold text-red-400 mb-4">

              ⚠ Session Timeout

            </h2>

            <p className="text-gray-300 mb-6">

              No activity detected.

              <br />

              App will logout automatically.

            </p>

            <div className="text-6xl font-bold text-white mb-6">

              {countdown}s

            </div>

            <button

              onClick={() => {

                setShowTimeout(false);

                setCountdown(60);

              }}

              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 py-3 rounded-2xl font-semibold"

            >

              ✅ Continue Session

            </button>

          </div>

        </div>

      )}

    </div>

  );

}

export default App;