export const mockSummary = {
  kpis: {
    totalUsers: 186,
    activeUsers: 149,
    totalWorkApprovals: 312,
    pendingWork: 43,
    approvedWork: 198,
    completedWork: 159,
    totalHazards: 94,
    openHazards: 26,
    closedHazards: 68,
    nearMissReports: 12,
    trainingRecords: 238
  },
  charts: {
    workStatus: [
      { name: "Pending", value: 43 },
      { name: "Approved", value: 198 },
      { name: "Completed", value: 159 },
      { name: "Rejected", value: 14 }
    ],
    hazardStatus: [
      { name: "Open", value: 26 },
      { name: "In Progress", value: 18 },
      { name: "Closed", value: 68 }
    ],
    monthlyTrend: [
      { month: "Jan", work: 42, hazards: 12, trainingCompletions: 20 },
      { month: "Feb", work: 48, hazards: 14, trainingCompletions: 26 },
      { month: "Mar", work: 53, hazards: 11, trainingCompletions: 33 },
      { month: "Apr", work: 60, hazards: 15, trainingCompletions: 36 },
      { month: "May", work: 64, hazards: 13, trainingCompletions: 41 },
      { month: "Jun", work: 72, hazards: 10, trainingCompletions: 48 }
    ],
    userActivity: [
      { month: "Jan", logins: 330 },
      { month: "Feb", logins: 350 },
      { month: "Mar", logins: 412 },
      { month: "Apr", logins: 468 },
      { month: "May", logins: 512 },
      { month: "Jun", logins: 540 }
    ],
    safetyPerformanceScore: 88
  },
  activities: [
    {
      id: "a1",
      module: "work",
      action: "approved",
      message: "Bridge deck casting approval moved to Level 3",
      timestamp: new Date().toISOString()
    },
    {
      id: "a2",
      module: "hazards",
      action: "closed",
      message: "Electrical panel exposure hazard closed with evidence",
      timestamp: new Date().toISOString()
    },
    {
      id: "a3",
      module: "training",
      action: "completed",
      message: "PPE Compliance Essentials completed by 26 users",
      timestamp: new Date().toISOString()
    }
  ]
};
