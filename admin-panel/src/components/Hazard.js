import { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from "framer-motion";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

function Hazard() {

  const [form, setForm] = useState({});
  const [beforeImage, setBefore] = useState(null);
  const [data, setData] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);

  const role = localStorage.getItem("role");

  // ================= COLORS =================

  const COLORS = ["#22c55e", "#facc15"];

  // ================= FETCH =================

  const fetchData = async () => {

    const res = await axios.get(
      'http://localhost:5000/hazard'
    );

    setData(res.data);

  };

  useEffect(() => {
    fetchData();
  }, []);

  // ================= DELETE =================

  const deleteHazard = async (id) => {

    if (!window.confirm(
      "Delete this hazard?"
    )) return;

    await axios.delete(
      `http://localhost:5000/hazard/${id}`
    );

    alert("🗑️ Deleted");

    fetchData();

  };

  // ================= SUBMIT =================

  const submit = async () => {

    if (
      !form.date ||
      !form.plaza ||
      !form.location ||
      !form.reportedBy ||
      !form.category ||
      !form.action ||
      !beforeImage
    ) {

      return alert(
        "⚠️ Fill all fields"
      );

    }

    const dataForm = new FormData();

    Object.keys(form).forEach((key) =>
      dataForm.append(key, form[key])
    );

    dataForm.append(
      'beforeImage',
      beforeImage
    );

    await axios.post(
      'http://localhost:5000/hazard',
      dataForm,
      {
        headers: {
          "Content-Type":
            "multipart/form-data"
        }
      }
    );

    alert("✅ Hazard Reported");

    setForm({});

    setBefore(null);

    document
      .querySelectorAll(
        "input[type='file']"
      )
      .forEach(i => i.value = "");

    fetchData();

  };

  // ================= CLOSE =================

  const closeHazard = async (
    id,
    file
  ) => {

    const formData = new FormData();

    formData.append(
      "afterImage",
      file
    );

    await axios.put(
      `http://localhost:5000/hazard/close/${id}`,
      formData
    );

    alert("✅ Closed");

    fetchData();

  };

  // ================= PIE DATA =================

  const chartData = [

    {
      name: "Closed",
      value: data.filter(
        d => d.status === "Closed"
      ).length
    },

    {
      name: "Open",
      value: data.filter(
        d =>
          d.status === "Open" ||
          !d.status
      ).length
    }

  ];

  return (

    <div className="flex gap-6 w-full text-white">

      {/* BACKGROUND */}

      <div className="fixed inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-black -z-10" />

      <div className="fixed w-[300px] h-[300px] bg-yellow-500 blur-[120px] opacity-20 top-0 left-0 -z-10" />

      {/* LEFT PANEL */}

      <motion.div

        initial={{
          opacity: 0,
          x: -30
        }}

        animate={{
          opacity: 1,
          x: 0
        }}

        className="bg-white/5 backdrop-blur-xl p-4 rounded-2xl w-3/4 shadow-xl border border-white/10 h-fit"

      >

        <h2 className="text-xl text-yellow-400 mb-4 font-semibold">

          ⚠️ Hazard & Near Miss

        </h2>

        {/* FORM */}

        <div className="grid grid-cols-2 gap-4">

          <InputDate
            value={form.date || ""}
            onChange={(v) =>
              setForm({
                ...form,
                date: v
              })
            }
          />

          <Select
            value={form.plaza || ""}
            onChange={(v) =>
              setForm({
                ...form,
                plaza: v
              })
            }
            options={[
              "Sasthan Plaza",
              "Hejamadi Plaza",
              "Talapady Plaza",
              "Site"
            ]}
            placeholder="Select Plaza"
          />

          <Input
            placeholder="Location & Chainage"
            value={form.location || ""}
            onChange={(v) =>
              setForm({
                ...form,
                location: v
              })
            }
          />

          <Input
            placeholder="Reported By"
            value={form.reportedBy || ""}
            onChange={(v) =>
              setForm({
                ...form,
                reportedBy: v
              })
            }
          />

          <Select
            value={form.category || ""}
            onChange={(v) =>
              setForm({
                ...form,
                category: v
              })
            }
            options={[
              "Hazard",
              "Near Miss"
            ]}
            placeholder="Category"
          />

          <Select
            value={form.action || ""}
            onChange={(v) =>
              setForm({
                ...form,
                action: v
              })
            }
            options={[
              "Maintenance Team",
              "Operation Team",
              "Kent Team",
              "Electrician Team",
              "RP Team",
              "Paramedical Team",
              "IT Team",
              "Housekeeping Team"
            ]}
            placeholder="Action Team"
          />

        </div>

        {/* IMAGE */}

        <div className="mt-4">

          <p className="text-gray-400 text-sm">

            Upload Before Image *

          </p>

          <input
            type="file"
            onChange={(e) =>
              setBefore(
                e.target.files[0]
              )
            }
          />

        </div>

        {/* BUTTON */}

        <button

          className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 py-2 rounded-xl mt-5 hover:scale-105 transition shadow-lg"

          onClick={submit}

        >

          🚀 Submit Hazard

        </button>

        {/* PIE CHART */}

        <div className="mt-8 bg-white/5 rounded-2xl p-4 border border-white/10">

          <h3 className="text-lg font-semibold text-yellow-300 mb-4">

            📊 Hazard Status Overview

          </h3>

          <div className="w-full h-[280px]">

            <ResponsiveContainer>

              <PieChart>

                <Pie

                  data={chartData}

                  cx="50%"

                  cy="50%"

                  outerRadius={90}

                  dataKey="value"

                  label

                >

                  {chartData.map(
                    (entry, index) => (

                      <Cell
                        key={index}
                        fill={
                          COLORS[
                            index %
                            COLORS.length
                          ]
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

        </div>

      </motion.div>

      {/* RIGHT LIST */}

      <div className="w-full space-y-4 overflow-y-auto pr-2 max-h-[95vh]">

        <h2 className="text-xl text-gray-300">

          ⚠️ Hazard List

        </h2>

        {data.map((item) => (

          <motion.div

            key={item._id}

            whileHover={{
              scale: 1.01
            }}

            className="bg-white/5 backdrop-blur-xl p-4 rounded-2xl shadow-lg border border-white/10 flex justify-between min-h-[270px] max-h-[240px] overflow-hidden"

          >

            {/* DETAILS */}

            <div className="w-2/3 overflow-hidden">

              <h3 className="text-yellow-300 font-semibold">

                {item.plaza}

              </h3>

              <p className="text-gray-400">

                📍 {item.location}

              </p>

              <p className="text-gray-400">

                👤 {item.reportedBy}

              </p>

              <p className="text-gray-400">

                {item.category}
                {" | "}
                {item.action}

              </p>

              <p className="mt-2">

                Status:

                <span className={`ml-2 font-semibold ${
                  item.status === "Closed"
                    ? "text-green-400"
                    : "text-yellow-400"
                }`}>

                  {item.status || "Open"}

                </span>

              </p>

              {/* CLOSE IMAGE */}

              {item.status === "Open" && (

                <div className="mt-3">

                  <p className="text-sm text-gray-400">

                    Upload After Image

                  </p>

                  <input
                    type="file"
                    onChange={(e) =>
                      closeHazard(
                        item._id,
                        e.target.files[0]
                      )
                    }
                  />

                </div>

              )}

              {/* ADMIN */}

              {role === "admin" && (

                <div className="mt-3 flex gap-2">

                  <Btn
                    color="red"
                    onClick={() =>
                      deleteHazard(
                        item._id
                      )
                    }
                  >
                    Delete
                  </Btn>

                </div>

              )}

            </div>

            {/* IMAGES */}

            <div className="w-1/3 flex flex-col items-end gap-3">

              {item.beforeImage && (

                <div className="relative">

                  <img

                    src={`http://localhost:5000/uploads/${item.beforeImage}`}

                    alt="Before"

                    className="w-60 h-24 object-cover rounded-xl cursor-pointer hover:scale-105 transition"

                    onClick={() =>
                      setSelectedImage({
                        url:
                          `http://localhost:5000/uploads/${item.beforeImage}`,
                        location:
                          item.location,
                        type: "Before"
                      })
                    }

                  />

                  <span className="absolute bottom-0 left-0 bg-black/70 text-xs px-2 py-1 rounded-tr-lg">

                    📍 {item.location}

                  </span>

                </div>

              )}

              {item.afterImage && (

                <div className="relative">

                  <img

                    src={`http://localhost:5000/uploads/${item.afterImage}`}

                    alt="After"

                    className="w-60 h-24 object-cover rounded-xl cursor-pointer hover:scale-105 transition"

                    onClick={() =>
                      setSelectedImage({
                        url:
                          `http://localhost:5000/uploads/${item.afterImage}`,
                        location:
                          item.location,
                        type: "After"
                      })
                    }

                  />

                  <span className="absolute bottom-0 left-0 bg-black/70 text-xs px-2 py-1 rounded-tr-lg">

                    📍 {item.location}

                  </span>

                </div>

              )}

            </div>

          </motion.div>

        ))}

      </div>

      {/* MODAL */}

      {selectedImage && (

        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">

          <motion.div

            initial={{
              scale: 0.8,
              opacity: 0
            }}

            animate={{
              scale: 1,
              opacity: 1
            }}

            className="bg-slate-900 p-4 rounded-2xl"

          >

            <h3 className="text-yellow-400 mb-3 text-center">

              {selectedImage.type}
              {" "}
              -
              {" "}
              📍
              {" "}
              {selectedImage.location}

            </h3>

            <img

              src={selectedImage.url}

              alt="Preview"

              className="max-h-[75vh] rounded-xl"

            />

            <button

              className="mt-4 w-full bg-red-500 py-2 rounded-xl hover:bg-red-600 transition"

              onClick={() =>
                setSelectedImage(null)
              }

            >

              Close

            </button>

          </motion.div>

        </div>

      )}

    </div>

  );

}

// ================= INPUT =================

function Input({
  value,
  onChange,
  placeholder
}) {

  return (

    <input

      value={value}

      placeholder={placeholder}

      onChange={(e) =>
        onChange(e.target.value)
      }

      className="bg-[#1f2937] p-2 rounded-lg text-white border border-white/10 focus:outline-none focus:border-yellow-400"

    />

  );

}

// ================= DATE =================

function InputDate({
  value,
  onChange
}) {

  return (

    <input

      type="date"

      value={value}

      onChange={(e) =>
        onChange(e.target.value)
      }

      className="bg-[#1f2937] p-2 rounded-lg text-white border border-white/10 focus:outline-none focus:border-yellow-400"

    />

  );

}

// ================= SELECT =================

function Select({
  value,
  onChange,
  options,
  placeholder
}) {

  return (

    <select

      value={value}

      onChange={(e) =>
        onChange(e.target.value)
      }

      className="bg-[#1f2937] p-2 rounded-lg text-white border border-white/10 focus:outline-none focus:border-yellow-400"

    >

      <option value="">
        {placeholder}
      </option>

      {options.map((o) => (

        <option key={o}>
          {o}
        </option>

      ))}

    </select>

  );

}

// ================= BUTTON =================

function Btn({
  children,
  color,
  onClick
}) {

  const colors = {

    red:
      "from-red-400 to-pink-600"

  };

  return (

    <button

      onClick={onClick}

      className={`px-3 py-1 rounded-lg bg-gradient-to-r ${colors[color]} hover:scale-105 transition`}

    >

      {children}

    </button>

  );

}

export default Hazard;