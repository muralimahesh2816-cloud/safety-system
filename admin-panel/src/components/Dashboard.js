import { motion } from "framer-motion";

function Dashboard({ stats, data }) {
  return (
    <div>
      <h2 className="text-3xl font-bold mb-6 text-cyan-400">
        📊 Dashboard
      </h2>

      {/* Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <Card title="Total" value={stats.total} color="from-slate-700 to-slate-800" />
        <Card title="Pending" value={stats.pending} color="from-yellow-500 to-yellow-600" />
        <Card title="Approved" value={stats.approved} color="from-green-500 to-green-600" />
        <Card title="Rejected" value={stats.rejected} color="from-red-500 to-red-600" />
      </div>

      {/* Incidents */}
      <h3 className="text-xl mb-4">🚨 Incidents</h3>

      <div className="grid gap-4">
        {data.map(item => (
          <motion.div
            key={item._id}
            whileHover={{ scale: 1.02 }}
            className="bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700"
          >
            <h4 className="text-lg font-semibold">{item.title}</h4>
            <p className="text-gray-400">{item.description}</p>

            <p className="mt-2">
              Status:
              <span className="ml-2 text-yellow-400">{item.status}</span>
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Card({ title, value, color }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className={`bg-gradient-to-r ${color} p-6 rounded-xl text-center shadow-xl`}
    >
      <h4 className="text-lg">{title}</h4>
      <h2 className="text-3xl font-bold mt-2">{value || 0}</h2>
    </motion.div>
  );
}

export default Dashboard;