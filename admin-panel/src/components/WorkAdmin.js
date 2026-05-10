import axios from 'axios';
import { useEffect, useState } from 'react';

function WorkAdmin() {
  const [data, setData] = useState([]);

  // Fetch work data
  const fetchData = async () => {
    const res = await axios.get('http://127.0.0.1:5000/work');
    setData(res.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update status
  const updateStatus = async (id, status) => {
    await axios.put(`http://127.0.0.1:5000/work/${id}`, { status });
    fetchData();
  };

  return (
    <div className="text-white">

      <h2 className="text-2xl mb-4">📝 Work Approval (Admin)</h2>

      <div className="grid gap-4">

        {data.map(item => (
          <div 
            key={item._id}
            className="bg-slate-800 p-4 rounded-lg shadow-lg flex justify-between items-center"
          >
            
            {/* LEFT SIDE */}
            <div>
              <h4 className="font-bold">{item.workType}</h4>
              <p className="text-gray-400">
                {item.location} | {item.chainage}
              </p>
              <p>
                Status: <span className="text-yellow-400">{item.status}</span>
              </p>
            </div>

            {/* RIGHT SIDE */}
            <div className="flex gap-2">

              <button 
                className="bg-green-500 px-3 py-1 rounded"
                onClick={() => updateStatus(item._id, "Approved")}
              >
                Approve
              </button>

              <button 
                className="bg-red-500 px-3 py-1 rounded"
                onClick={() => updateStatus(item._id, "Rejected")}
              >
                Reject
              </button>

            </div>

          </div>
        ))}

      </div>

    </div>
  );
}

export default WorkAdmin;