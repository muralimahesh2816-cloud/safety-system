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

function WorkApproval() {

  const [form, setForm] = useState({});
  const [beforeImage, setBefore] = useState(null);
  const [data, setData] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);

  const role = localStorage.getItem("role");

  // ================= PIE COLORS =================

  const COLORS = ["#22c55e", "#facc15"];

  // ================= FETCH =================

  const fetchData = async () => {

    const res = await axios.get(
      'http://localhost:5000/work'
    );

    setData(res.data);

  };

  useEffect(() => {
    fetchData();
  }, []);

  // ================= SUBMIT =================

  const submit = async () => {

    if (
      !form.workType ||
      !form.location ||
      !form.chainage ||
      !form.workersCount ||
      !beforeImage
    ) {

      return alert("⚠️ Fill all fields");

    }

    const dataForm = new FormData();

    Object.keys(form).forEach((k) =>
      dataForm.append(k, form[k])
    );

    dataForm.append(
      'beforeImage',
      beforeImage
    );

    await axios.post(
      'http://localhost:5000/work',
      dataForm
    );

    alert("✅ Work Submitted");

    setForm({});

    setBefore(null);

    document
      .querySelectorAll("input[type='file']")
      .forEach(i => i.value = "");

    fetchData();

  };

  // ================= STATUS UPDATE =================

  const updateStatus = async (
    id,
    status
  ) => {

    await axios.put(
      `http://localhost:5000/work/${id}`,
      {
        status,
        approvedBy:
          localStorage.getItem("name")
          || "Admin"
      }
    );

    fetchData();

  };

  // ================= DELETE =================

  const deleteWork = async (id) => {

    if (
      !window.confirm(
        "Delete this work?"
      )
    ) return;

    await axios.delete(
      `http://localhost:5000/work/${id}`
    );

    fetchData();

  };

  // ================= COMPLETE =================

  const uploadCompletion = async (
    id,
    file
  ) => {

    const formData = new FormData();

    formData.append(
      "afterImage",
      file
    );

    await axios.put(
      `http://localhost:5000/work/complete/${id}`,
      formData
    );

    alert("✅ Completion Uploaded");

    fetchData();

  };

  // ================= PIE DATA =================

  const chartData = [

    {
      name: "Approved",
      value: data.filter(
        d => d.status === "Approved"
      ).length
    },

    {
      name: "Pending",
      value: data.filter(
        d =>
          d.status === "Pending" ||
          !d.status
      ).length
    }

  ];

  return (

    <div className="flex gap-6 w-full text-white">

      {/* BACKGROUND */}

      <div className="fixed inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-black -z-10" />

      <div className="fixed w-[300px] h-[300px] bg-cyan-500 blur-[120px] opacity-20 top-0 left-0 -z-10" />

      {/* LEFT FORM */}

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

        <h2 className="text-xl text-cyan-400 mb-4 font-semibold">

          📝 Work Approval

        </h2>

        <div className="grid grid-cols-2 gap-4">

          <Select

            value={form.workType || ""}

            onChange={(v) =>
              setForm({
                ...form,
                workType: v
              })
            }

            options={[
              "Road Work",
              "Lights Changing",
              "Height Work",
              "Grass Cutting",
              "Watering Plants",
              "Plaza Maintenance"
            ]}

          />

          <Input

            placeholder="Location"

            value={form.location || ""}

            onChange={(v) =>
              setForm({
                ...form,
                location: v
              })
            }

          />

          <Input

            placeholder="Chainage No"

            value={form.chainage || ""}

            onChange={(v) =>
              setForm({
                ...form,
                chainage: v
              })
            }

          />

          <Input

            placeholder="Workers Count"

            value={form.workersCount || ""}

            onChange={(v) =>
              setForm({
                ...form,
                workersCount: v
              })
            }

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

        {/* SUBMIT */}

        <button

          className="w-full mt-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:scale-105 transition shadow-lg"

          onClick={submit}

        >

          🚀 Submit Work

        </button>

        {/* PIE CHART */}

        <div className="mt-8 bg-white/5 rounded-2xl p-4 border border-white/10">

          <h3 className="text-lg font-semibold text-cyan-300 mb-4">

            📊 Work Approval Status

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

      <div className="w-full space-y-2 overflow-y-auto pr-4 max-h-[95vh]">

        <h2 className="text-xl text-gray-300">

          📋 Work List

        </h2>

        {data.map((item) => (

          <motion.div

            key={item._id}

            whileHover={{
              scale: 1.01
            }}

            className="bg-white/5 backdrop-blur-xl p-4 rounded-2xl shadow-lg border border-white/10 flex justify-between min-h-[240px] max-h-[220px] overflow-hidden"

          >

            {/* DETAILS */}

            <div className="w-2/3 overflow-hidden">

              <h3 className="text-cyan-300 font-semibold">

                {item.workType}

              </h3>

              <p className="text-gray-400">

                {item.location}
                {" | "}
                {item.chainage}

              </p>

              <p className="text-gray-400">

                Workers:
                {" "}
                {item.workersCount}

              </p>

              <p className="mt-1">

                Status:

                <span className={`ml-2 font-semibold ${
                  item.status === "Approved"
                    ? "text-green-400"
                    : item.status === "Rejected"
                    ? "text-red-400"
                    : item.status === "Completed"
                    ? "text-blue-400"
                    : "text-yellow-400"
                }`}>

                  {item.status || "Pending"}

                </span>

              </p>

              {/* APPROVED BY */}

              {item.approvedBy && (

                <p className="text-gray-400 mt-1">

                  Approved By:
                  {" "}
                  {item.approvedBy}

                </p>

              )}

              {/* ADMIN */}

              {role === "admin" && (

                <div className="mt-3 flex gap-2 flex-wrap">

                  <Btn
                    color="green"
                    onClick={() =>
                      updateStatus(
                        item._id,
                        "Approved"
                      )
                    }
                  >
                    Approve
                  </Btn>

                  <Btn
                    color="red"
                    onClick={() =>
                      updateStatus(
                        item._id,
                        "Rejected"
                      )
                    }
                  >
                    Reject
                  </Btn>

                  <Btn
                    color="gray"
                    onClick={() =>
                      deleteWork(item._id)
                    }
                  >
                    Delete
                  </Btn>

                </div>

              )}

              {/* COMPLETION */}

              {item.status === "Approved" && (

                <div className="mt-3">

                  <p className="text-xs text-gray-400">

                    Upload Completion Image

                  </p>

                  <input
                    type="file"
                    onChange={(e) =>
                      uploadCompletion(
                        item._id,
                        e.target.files[0]
                      )
                    }
                  />

                </div>

              )}

            </div>

            {/* IMAGES */}

            <div className="w-1/3 flex flex-col gap-2 items-end">

              {item.beforeImage && (

                <img

                  src={`http://localhost:5000/uploads/${item.beforeImage}`}

                  alt="before"

                  className="w-52 h-24 object-cover rounded-xl cursor-pointer hover:scale-105 transition"

                  onClick={() =>
                    setSelectedImage(
                      item.beforeImage
                    )
                  }

                />

              )}

              {item.afterImage && (

                <img

                  src={`http://localhost:5000/uploads/${item.afterImage}`}

                  alt="after"

                  className="w-52 h-24 object-cover rounded-xl cursor-pointer hover:scale-105 transition"

                  onClick={() =>
                    setSelectedImage(
                      item.afterImage
                    )
                  }

                />

              )}

            </div>

          </motion.div>

        ))}

      </div>

      {/* IMAGE MODAL */}

      {selectedImage && (

        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50">

          <motion.div

            initial={{
              scale: 0.8,
              opacity: 0
            }}

            animate={{
              scale: 1,
              opacity: 1
            }}

            className="bg-slate-900 p-4 rounded-xl"

          >

            <img

              src={`http://localhost:5000/uploads/${selectedImage}`}

              alt="preview"

              className="max-h-[75vh] rounded-lg"

            />

            <button

              className="mt-3 w-full bg-red-500 py-2 rounded-lg hover:bg-red-600 transition"

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

      className="bg-[#1f2937] p-2 rounded-lg text-white border border-white/10 focus:outline-none focus:border-cyan-400"

    />

  );

}

// ================= SELECT =================

function Select({
  value,
  onChange,
  options
}) {

  return (

    <select

      value={value}

      onChange={(e) =>
        onChange(e.target.value)
      }

      className="bg-[#1f2937] p-2 rounded-lg text-white border border-white/10 focus:outline-none focus:border-cyan-400"

    >

      <option value="">
        Select Work Type
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

    green:
      "from-green-400 to-emerald-600",

    red:
      "from-red-400 to-pink-600",

    gray:
      "from-gray-500 to-gray-700"

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

export default WorkApproval;