import { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "../assets/logo.png";

function Reports() {

  const [type, setType] = useState("work");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [plaza, setPlaza] = useState("");
  const [report, setReport] = useState([]);

  // ================= GENERATE REPORT =================

  const generateReport = async () => {

    try {

      let result = [];

      // ================= WORK REPORT =================

      if (type === "work") {

        const res = await axios.get(
          "http://https://safety-backend-h2y7.onrender.com/reports/work"
        );

        const filtered = res.data.filter((item) => {

          const d = new Date(item.date || item.createdAt);

          return (
            (!fromDate || d >= new Date(fromDate)) &&
            (!toDate || d <= new Date(toDate)) &&
            (!plaza || item.plaza === plaza)
          );

        });

        result = filtered;

      }

      // ================= HAZARD REPORT =================

      else if (type === "hazard") {

        const res = await axios.get(
          "http://https://safety-backend-h2y7.onrender.com/reports/hazard"
        );

        const filtered = res.data.filter((item) => {

          const d = new Date(item.date || item.createdAt);

          return (
            (!fromDate || d >= new Date(fromDate)) &&
            (!toDate || d <= new Date(toDate)) &&
            (!plaza || item.plaza === plaza)
          );

        });

        result = filtered;

      }

      // ================= DATE-WISE HAZARDS =================

      else if (type === "date") {

        const res = await axios.get(
          "http://https://safety-backend-h2y7.onrender.com/reports/hazard"
        );

        const filtered = res.data.filter((item) => {

          const d = new Date(item.date || item.createdAt);

          return (
            (!fromDate || d >= new Date(fromDate)) &&
            (!toDate || d <= new Date(toDate))
          );

        });

        const map = {};

        filtered.forEach((item) => {

          const d = (item.date || item.createdAt)
            .split("T")[0];

          if (!map[d]) {

            map[d] = {
              Date: d,
              Total: 0,
              Open: 0,
              Closed: 0
            };

          }

          map[d].Total++;

          if (item.status === "Closed") {
            map[d].Closed++;
          } else {
            map[d].Open++;
          }

        });

        result = Object.values(map);

      }

      // ================= USER-WISE HAZARDS =================

      else if (type === "user") {

        const res = await axios.get(
          "http://https://safety-backend-h2y7.onrender.com/reports/hazard"
        );

        const userMap = {};

        res.data.forEach((item) => {

          const user = item.reportedBy || "Unknown";

          if (!userMap[user]) {

            userMap[user] = {
              User: user,
              hazardsUploaded: 0,
              open: 0,
              closed: 0
            };

          }

          userMap[user].hazardsUploaded++;

          if (item.status === "Closed") {
            userMap[user].closed++;
          } else {
            userMap[user].open++;
          }

        });

        result = Object.values(userMap).map((u) => ({
          "User Name": u.User,
          "Hazards Uploaded": u.hazardsUploaded,
          "Status":
            `${u.closed} Closed / ${u.open} Open`
        }));

      }

      // ================= APPROVED WORK REPORT =================

      else if (type === "approved") {

        const res = await axios.get(
          "http://https://safety-backend-h2y7.onrender.com/reports/work"
        );

        const filtered = res.data.filter((item) => {

          const d = new Date(item.date || item.createdAt);

          return (
            (!fromDate || d >= new Date(fromDate)) &&
            (!toDate || d <= new Date(toDate)) &&
            item.status === "Approved"
          );

        });

        result = filtered.map((item) => ({

          "Work Type": item.workType || "-",

          "Location": item.location || "-",

          "Workers Count": item.workersCount || "-",

          "Approved By": item.approvedBy || "Admin"

        }));

      }

      setReport(result);

    } catch (err) {

      console.error(err);
      alert("Error generating report");

    }

  };

  // ================= RESET REPORT =================

  useEffect(() => {
    setReport([]);
  }, [type, fromDate, toDate, plaza]);

  // ================= EXPORT EXCEL =================

  const exportExcel = () => {

    const ws = XLSX.utils.json_to_sheet(report);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      ws,
      "Report"
    );

    XLSX.writeFile(
      wb,
      `${type}_report.xlsx`
    );

  };

  // ================= EXPORT CSV =================

  const exportCSV = () => {

    const ws = XLSX.utils.json_to_sheet(report);

    const csv =
      XLSX.utils.sheet_to_csv(ws);

    const blob = new Blob([csv]);

    const link =
      document.createElement("a");

    link.href =
      URL.createObjectURL(blob);

    link.download =
      `${type}_report.csv`;

    link.click();

  };

  // ================= EXPORT PDF =================

  const exportPDF = () => {

    const doc = new jsPDF("landscape");

    const now = new Date();

    const generatedDate =
      now.toLocaleDateString() +
      " " +
      now.toLocaleTimeString();

    const generatedBy =
      localStorage.getItem("name")
      || "Admin";

    // HEADER

    doc.setFontSize(20);

    doc.setTextColor(30, 41, 59);

    doc.text(
      "Sasthan Udupi Tollway Pvt Ltd",
      14,
      18
    );

    let reportTitle =
      "Safety Management Report";

    if (type === "work") {
      reportTitle =
        "Work Approval Report";
    }

    else if (type === "hazard") {
      reportTitle =
        "Hazard Report";
    }

    else if (type === "date") {
      reportTitle =
        "Date-wise Hazard Report";
    }

    else if (type === "user") {
      reportTitle =
        "User-wise Hazard Report";
    }

    else if (type === "approved") {
      reportTitle =
        "Approved Work Report";
    }

    doc.setFontSize(13);

    doc.text(
      reportTitle,
      14,
      28
    );

    doc.setFontSize(10);

    doc.text(
      `Generated By : ${generatedBy}`,
      14,
      38
    );

    doc.text(
      `Generated Date & Time : ${generatedDate}`,
      14,
      45
    );

    // LOGO

    doc.addImage(
      logo,
      "PNG",
      245,
      8,
      36,
      28
    );

    let columns = [];
    let rows = [];

    // ================= WORK REPORT =================

    if (type === "work") {

      columns = [
        "Date",
        "Work Type",
        "Location",
        "Chainage No",
        "Workers Count",
        "Status"
      ];

      rows = report.map((item) => [

        (item.date || item.createdAt)
          ?.split("T")[0],

        item.workType || "-",

        item.location || "-",

        item.chainageNo || "-",

        item.workersCount || "-",

        item.status || "-"

      ]);

    }

    // ================= HAZARD REPORT =================

    else if (type === "hazard") {

      columns = [
        "Date",
        "Plaza",
        "Location",
        "Reported By",
        "Category",
        "Action Team",
        "Status"
      ];

      rows = report.map((item) => [

        (item.date || item.createdAt)
          ?.split("T")[0],

        item.plaza || "-",

        item.location || "-",

        item.reportedBy || "-",

        item.category || "-",

        item.action || "-",

        item.status || "-"

      ]);

    }

    // ================= APPROVED REPORT =================

    else if (type === "approved") {

      columns = [
        "Work Type",
        "Location",
        "Workers Count",
        "Approved By"
      ];

      rows = report.map((item) => [

        item["Work Type"],

        item["Location"],

        item["Workers Count"],

        item["Approved By"]

      ]);

    }

    // ================= SUMMARY REPORTS =================

    else {

      columns =
        Object.keys(report[0] || {});

      rows = report.map((row) =>
        Object.values(row)
      );

    }

    // TABLE

    autoTable(doc, {

      head: [columns],

      body: rows,

      startY: 58,

      theme: "grid",

      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: "linebreak",
        valign: "middle"
      },

      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontStyle: "bold",
        halign: "center"
      },

      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },

      margin: {
        left: 10,
        right: 10
      }

    });

    // FOOTER

    const pageCount =
      doc.internal.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {

      doc.setPage(i);

      doc.setFontSize(9);

      doc.text(
        `Page ${i} of ${pageCount}`,
        260,
        200
      );

    }

    // SAVE

    doc.save(`${type}_report.pdf`);

  };

  return (

    <div>

      <h2 className="text-xl font-semibold mb-4">
        Reports
      </h2>

      {/* FILTER */}

      <div className="bg-slate-800 p-4 rounded-md mb-6 flex flex-wrap gap-4 items-end">

        {/* REPORT TYPE */}

        <div>

          <p className="text-sm mb-1">
            Report Type
          </p>

          <select
            className="bg-slate-700 text-white px-4 py-2 rounded-md w-52 border border-slate-600 focus:outline-none"
            value={type}
            onChange={(e) =>
              setType(e.target.value)
            }
          >

            <option value="work">
              Work Approval
            </option>

            <option value="hazard">
              Hazard
            </option>

            <option value="date">
              Date-wise Hazards
            </option>

            <option value="user">
              User-wise Hazards
            </option>

            <option value="approved">
              Approved Work Report
            </option>

          </select>

        </div>

        {/* FROM */}

        <div>

          <p className="text-sm mb-1">
            From
          </p>

          <input
            type="date"
            className="bg-slate-700 text-white px-4 py-2 rounded-md border border-slate-600 focus:outline-none"
            value={fromDate}
            onChange={(e) =>
              setFromDate(e.target.value)
            }
          />

        </div>

        {/* TO */}

        <div>

          <p className="text-sm mb-1">
            To
          </p>

          <input
            type="date"
            className="bg-slate-700 text-white px-4 py-2 rounded-md border border-slate-600 focus:outline-none"
            value={toDate}
            onChange={(e) =>
              setToDate(e.target.value)
            }
          />

        </div>

        {/* PLAZA */}

        <div>

          <p className="text-sm mb-1">
            Plaza
          </p>

          <select
            className="bg-slate-700 text-white px-4 py-2 rounded-md w-52 border border-slate-600 focus:outline-none"
            value={plaza}
            onChange={(e) =>
              setPlaza(e.target.value)
            }
          >

            <option value="">
              All
            </option>

            <option>
              Sasthan Plaza
            </option>

            <option>
              Hejamadi Plaza
            </option>

            <option>
              Talapady Plaza
            </option>

          </select>

        </div>

        {/* BUTTON */}

        <button
          className="bg-blue-600 hover:bg-blue-700 px-5 py-2 rounded-md transition"
          onClick={generateReport}
        >
          Generate
        </button>

      </div>

      {/* EXPORT */}

      <div className="flex gap-3 mb-4">

        <button
          className="bg-green-600 px-3 py-1 rounded"
          onClick={exportExcel}
        >
          Excel
        </button>

        <button
          className="bg-yellow-600 px-3 py-1 rounded"
          onClick={exportCSV}
        >
          CSV
        </button>

        <button
          className="bg-red-600 px-3 py-1 rounded"
          onClick={exportPDF}
        >
          PDF
        </button>

      </div>

      {/* WORK / HAZARD */}

      {(type === "work" || type === "hazard") && (

        <div className="space-y-4">

          {report.map((item) => (

            <div
              key={item._id}
              className="bg-slate-800 p-4 rounded-md flex justify-between items-center hover:bg-slate-700 transition"
            >

              {/* DETAILS */}

              <div className="text-sm space-y-1">

                <p>
                  <b>Date:</b>{" "}
                  {(item.date || item.createdAt)
                    ?.split("T")[0]}
                </p>

                {type === "work" && (
                  <>
                    <p>
                      <b>Work Type:</b>
                      {" "}
                      {item.workType}
                    </p>

                    <p>
                      <b>Location:</b>
                      {" "}
                      {item.location}
                    </p>

                    <p>
                      <b>Chainage No:</b>
                      {" "}
                      {item.chainageNo}
                    </p>

                    <p>
                      <b>Workers Count:</b>
                      {" "}
                      {item.workersCount}
                    </p>
                  </>
                )}

                {type === "hazard" && (
                  <>
                    <p>
                      <b>Plaza:</b>
                      {" "}
                      {item.plaza}
                    </p>

                    <p>
                      <b>Location:</b>
                      {" "}
                      {item.location}
                    </p>

                    <p>
                      <b>Reported By:</b>
                      {" "}
                      {item.reportedBy}
                    </p>

                    <p>
                      <b>Action Team:</b>
                      {" "}
                      {item.action}
                    </p>
                  </>
                )}

                <p>
                  <b>Status:</b>
                  {" "}
                  {item.status}
                </p>

              </div>

              {/* IMAGES */}

              <div className="flex gap-4">

                {item.beforeImage && (

                  <div className="text-center">

                    <p className="text-xs">
                      Before
                    </p>

                    <img
                      src={`http://https://safety-backend-h2y7.onrender.com/uploads/${item.beforeImage}`}
                      alt="Before"
                      className="w-28 h-28 object-cover rounded hover:scale-105 transition cursor-pointer"
                      onClick={() =>
                        window.open(
                          `http://https://safety-backend-h2y7.onrender.com/uploads/${item.beforeImage}`
                        )
                      }
                    />

                  </div>

                )}

                {item.afterImage && (

                  <div className="text-center">

                    <p className="text-xs">
                      After
                    </p>

                    <img
                      src={`http://https://safety-backend-h2y7.onrender.com/uploads/${item.afterImage}`}
                      alt="After"
                      className="w-28 h-28 object-cover rounded hover:scale-105 transition cursor-pointer"
                      onClick={() =>
                        window.open(
                          `http://https://safety-backend-h2y7.onrender.com/uploads/${item.afterImage}`
                        )
                      }
                    />

                  </div>

                )}

              </div>

            </div>

          ))}

        </div>

      )}

      {/* SUMMARY TABLE */}

      {(type === "date" ||
        type === "user" ||
        type === "approved") && (

        <div className="bg-slate-800 rounded-md overflow-auto">

          <table className="w-full text-sm">

            <thead className="bg-slate-700">

              <tr>

                {report[0] &&
                  Object.keys(report[0]).map((key) => (

                    <th
                      key={key}
                      className="p-3 text-left"
                    >
                      {key}
                    </th>

                  ))}

              </tr>

            </thead>

            <tbody>

              {report.map((row, i) => (

                <tr
                  key={i}
                  className="border-t border-slate-700"
                >

                  {Object.values(row).map((val, idx) => (

                    <td
                      key={idx}
                      className="p-3"
                    >
                      {val}
                    </td>

                  ))}

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      )}

    </div>

  );

}

export default Reports;