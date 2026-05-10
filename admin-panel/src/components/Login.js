import { useState } from "react";

import axios from "axios";

import { motion } from "framer-motion";

import {
  Eye,
  EyeOff,
  ShieldCheck
} from "lucide-react";

function Login({ setUser }) {

  // ================= STATES =================

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  // ================= LOGIN =================

  const login = async () => {

    if (!email || !password) {

      return alert(
        "⚠ Enter Email & Password"
      );

    }

    try {

      setLoading(true);

      const res =
        await axios.post(

          "http://localhost:5000/login",

          {
            email,
            password
          }

        );

      // ================= STORAGE =================

      localStorage.setItem(
        "token",
        res.data.token
      );

      localStorage.setItem(
        "userId",
        res.data.id
      );

      localStorage.setItem(
        "role",
        res.data.role
      );

      localStorage.setItem(
        "name",
        res.data.name || ""
      );

      localStorage.setItem(
        "email",
        res.data.email || ""
      );

      localStorage.setItem(
        "mobile",
        res.data.mobile || ""
      );

      localStorage.setItem(
        "profileImage",
        res.data.profileImage || ""
      );

      localStorage.setItem(
        "lastLogin",
        new Date().toLocaleString()
      );

      setUser(
        res.data.role
      );

    } catch (err) {

      console.log(err);

      alert(
        "❌ Invalid Email or Password"
      );

    } finally {

      setLoading(false);

    }

  };

  // ================= UI =================

  return (

    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#020617] via-[#0f172a] to-black text-white overflow-hidden px-4">

      {/* BACKGROUND EFFECT */}

      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500 blur-[160px] opacity-20" />

      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500 blur-[160px] opacity-20" />

      {/* LOGIN CARD */}

      <motion.div

        initial={{
          opacity: 0,
          scale: 0.9,
          y: 30
        }}

        animate={{
          opacity: 1,
          scale: 1,
          y: 0
        }}

        transition={{
          duration: 0.5
        }}

        className="relative z-10 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[36px] p-10 w-full max-w-[430px] shadow-[0_0_60px_rgba(0,0,0,0.45)]"

      >

        {/* HEADER */}

        <div className="text-center mb-10">

          <div className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center mx-auto mb-5 shadow-2xl">

            <ShieldCheck size={38} />

          </div>

          <h1 className="text-4xl font-bold text-cyan-400 mb-3">

            Safety HSE

          </h1>

          <p className="text-gray-400">

            Secure Login Access

          </p>

        </div>

        {/* FORM */}

        <form

          onSubmit={(e) => {

            e.preventDefault();

            login();

          }}

        >

          {/* EMAIL */}

          <div className="mb-5">

            <p className="text-sm text-gray-400 mb-2">

              Email Address

            </p>

            <input

              type="email"

              placeholder="Enter Email"

              value={email}

              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }

              className="w-full bg-[#1e293b] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-cyan-400 transition"

            />

          </div>

          {/* PASSWORD */}

          <div className="mb-8">

            <p className="text-sm text-gray-400 mb-2">

              Password

            </p>

            <div className="relative">

              <input

                type={
                  showPassword
                    ? "text"
                    : "password"
                }

                placeholder="Enter Password"

                value={password}

                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }

                className="w-full bg-[#1e293b] border border-white/10 rounded-2xl px-5 py-4 pr-14 text-white focus:outline-none focus:border-cyan-400 transition"

              />

              <button

                type="button"

                onClick={() =>
                  setShowPassword(
                    !showPassword
                  )
                }

                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-400 transition"

              >

                {showPassword ? (
                  <EyeOff size={22} />
                ) : (
                  <Eye size={22} />
                )}

              </button>

            </div>

          </div>

          {/* LOGIN BUTTON */}

          <button

            type="submit"

            disabled={loading}

            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 py-4 rounded-2xl font-semibold text-lg hover:scale-[1.02] transition shadow-2xl disabled:opacity-50"

          >

            {loading
              ? "⏳ Logging In..."
              : "✅ Login"}

          </button>

        </form>

      </motion.div>

    </div>

  );

}

export default Login;