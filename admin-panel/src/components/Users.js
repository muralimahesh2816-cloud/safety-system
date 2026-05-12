import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { motion } from "framer-motion";

function Users() {

  // ================= STATES =================

  const [form, setForm] =
    useState({

      name: "",

      email: "",

      mobile: "",

      password: "",

      role: ""

    });

  const [users, setUsers] =
    useState([]);

  const [editId, setEditId] =
    useState(null);

  const token =
    localStorage.getItem("token");

  const role =
    localStorage.getItem("role");

  // ================= FETCH USERS =================

  const fetchUsers =
    useCallback(async () => {

      try {

        const res =
          await axios.get(

            "https://safety-backend-h2y7.onrender.com/users",

            {
              headers: {

                Authorization:
                  `Bearer ${token}`

              }
            }

          );

        setUsers(res.data);

      } catch (err) {

        console.error(
          "User fetch error:",
          err
        );

      }

    }, [token]);

  useEffect(() => {

    fetchUsers();

  }, [fetchUsers]);

  // ================= RESET =================

  const resetForm = () => {

    setForm({

      name: "",

      email: "",

      mobile: "",

      password: "",

      role: ""

    });

    setEditId(null);

  };

  // ================= CREATE USER =================

  const createUser =
    async () => {

      if (

        !form.name ||

        !form.email ||

        !form.mobile ||

        !form.password ||

        !form.role

      ) {

        return alert(
          "⚠ Fill all fields"
        );

      }

      try {

        await axios.post(

          "https://safety-backend-h2y7.onrender.com/register",

          form,

          {
            headers: {

              Authorization:
                `Bearer ${token}`

            }
          }

        );

        alert(
          "✅ User Created"
        );

        resetForm();

        fetchUsers();

      } catch (err) {

        console.log(err);

        alert(
          "User creation failed"
        );

      }

    };

  // ================= UPDATE USER =================

  const updateUser =
    async () => {

      try {

        await axios.put(

          `https://safety-backend-h2y7.onrender.com/users/${editId}`,

          form,

          {
            headers: {

              Authorization:
                `Bearer ${token}`

            }
          }

        );

        alert(
          "✅ User Updated"
        );

        resetForm();

        fetchUsers();

      } catch (err) {

        console.error(
          "Update error:",
          err
        );

      }

    };

  // ================= DELETE USER =================

  const deleteUser =
    async (id) => {

      if (
        !window.confirm(
          "Delete user?"
        )
      ) return;

      try {

        await axios.delete(

          `https://safety-backend-h2y7.onrender.com/users/${id}`,

          {
            headers: {

              Authorization:
                `Bearer ${token}`

            }
          }

        );

        alert(
          "🗑 User Deleted"
        );

        fetchUsers();

      } catch (err) {

        console.error(
          "Delete error:",
          err
        );

      }

    };

  // ================= UI =================

  return (

    <div className="flex gap-6 w-full text-white">

      {/* BACKGROUND */}

      <div className="fixed inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-black -z-10" />

      <div className="fixed top-0 right-0 w-[350px] h-[350px] bg-cyan-500 blur-[140px] opacity-20 -z-10" />

      {/* LEFT FORM */}

      <motion.div

        initial={{
          opacity: 0,
          x: -40
        }}

        animate={{
          opacity: 1,
          x: 0
        }}

        className="bg-white/5 backdrop-blur-xl p-6 rounded-3xl w-[380px] border border-white/10 shadow-2xl sticky top-6 h-fit"

      >

        <h2 className="text-2xl font-bold text-cyan-400 mb-6">

          {editId
            ? "✏ Edit User"
            : "👤 Create User"}

        </h2>

        <div className="space-y-4">

          {/* NAME */}

          <input

            className="w-full bg-[#1e293b] border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"

            placeholder="Full Name"

            value={form.name}

            onChange={(e) =>

              setForm({

                ...form,

                name:
                  e.target.value

              })

            }

          />

          {/* EMAIL */}

          <input

            className="w-full bg-[#1e293b] border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"

            placeholder="Email Address"

            value={form.email}

            onChange={(e) =>

              setForm({

                ...form,

                email:
                  e.target.value

              })

            }

          />

          {/* MOBILE */}

          <input

            className="w-full bg-[#1e293b] border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"

            placeholder="Mobile Number"

            value={form.mobile}

            onChange={(e) =>

              setForm({

                ...form,

                mobile:
                  e.target.value

              })

            }

          />

          {/* PASSWORD */}

          <input

            className="w-full bg-[#1e293b] border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"

            placeholder="Password"

            type="password"

            value={form.password}

            onChange={(e) =>

              setForm({

                ...form,

                password:
                  e.target.value

              })

            }

          />

          {/* ROLE */}

          <select

            className="w-full bg-[#1e293b] border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400"

            value={form.role}

            onChange={(e) =>

              setForm({

                ...form,

                role:
                  e.target.value

              })

            }

          >

            <option value="">

              Select Role

            </option>

            <option value="user">

              User

            </option>

            <option value="admin">

              Admin

            </option>

          </select>

          {/* BUTTONS */}

          {editId ? (

            <div className="flex gap-3">

              <button

                className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 py-3 rounded-2xl font-semibold hover:scale-[1.02] transition"

                onClick={updateUser}

              >

                ✅ Update

              </button>

              <button

                className="flex-1 bg-gradient-to-r from-red-500 to-pink-600 py-3 rounded-2xl font-semibold hover:scale-[1.02] transition"

                onClick={resetForm}

              >

                ✖ Cancel

              </button>

            </div>

          ) : (

            <button

              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 py-3 rounded-2xl font-semibold hover:scale-[1.02] transition shadow-xl"

              onClick={createUser}

            >

              🚀 Create User

            </button>

          )}

        </div>

      </motion.div>

      {/* RIGHT LIST */}

      <div className="flex-1">

        <h2 className="text-2xl font-bold text-gray-200 mb-6">

          👥 Users List

        </h2>

        {users.length === 0 && (

          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center text-gray-400">

            No users found

          </div>

        )}

        <div className="space-y-4">

          {users.map((u) => (

            <motion.div

              key={u._id}

              whileHover={{
                scale: 1.01
              }}

              className="bg-white/5 backdrop-blur-xl p-5 rounded-3xl border border-white/10 flex justify-between items-center shadow-xl"

            >

              {/* USER DETAILS */}

              <div className="flex items-center gap-4">

                {/* AVATAR */}

                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center text-2xl font-bold shadow-xl">

                  {u.name
                    ?.charAt(0)
                    ?.toUpperCase()}

                </div>

                {/* INFO */}

                <div>

                  <h3 className="text-xl font-semibold text-cyan-300">

                    {u.name}

                  </h3>

                  <p className="text-gray-400">

                    📧 {u.email}

                  </p>

                  <p className="text-gray-400">

                    📱 {u.mobile || "-"}

                  </p>

                  <div className="mt-2">

                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${

                      u.role === "admin"

                        ? "bg-red-500/20 text-red-300"

                        : "bg-cyan-500/20 text-cyan-300"

                    }`}>

                      {u.role}

                    </span>

                  </div>

                </div>

              </div>

              {/* ACTIONS */}

              {role === "admin" && (

                <div className="flex gap-3">

                  <button

                    className="px-5 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl font-semibold hover:scale-105 transition"

                    onClick={() => {

                      setEditId(u._id);

                      setForm({

                        name:
                          u.name || "",

                        email:
                          u.email || "",

                        mobile:
                          u.mobile || "",

                        password: "",

                        role:
                          u.role || ""

                      });

                    }}

                  >

                    ✏ Edit

                  </button>

                  <button

                    className="px-5 py-2 bg-gradient-to-r from-red-500 to-pink-600 rounded-2xl font-semibold hover:scale-105 transition"

                    onClick={() =>
                      deleteUser(u._id)
                    }

                  >

                    🗑 Delete

                  </button>

                </div>

              )}

            </motion.div>

          ))}

        </div>

      </div>

    </div>

  );

}

export default Users;