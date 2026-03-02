const ExcelJS = require("exceljs");

const formatDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
};

const formatDateTime = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().replace("T", " ").slice(0, 19);
};

const generateAttendanceWorkbook = async ({ roomName, reportDate, records = [] }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Smart Attendance";
  workbook.created = new Date();

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Value", key: "value", width: 42 },
  ];
  summarySheet.addRows([
    { field: "Room", value: roomName || "Unknown" },
    { field: "Date", value: formatDate(reportDate) },
    { field: "Total Records", value: records.length },
    { field: "Generated At (UTC)", value: formatDateTime(new Date()) },
  ]);
  summarySheet.getRow(1).font = { bold: true };

  const attendanceSheet = workbook.addWorksheet("Attendance");
  attendanceSheet.columns = [
    { header: "Student Name", key: "studentName", width: 24 },
    { header: "Student Email", key: "studentEmail", width: 32 },
    { header: "Section", key: "section", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Inside Time (min)", key: "insideTime", width: 18 },
    { header: "Boundary Crossings", key: "boundaryCrossings", width: 20 },
    { header: "Suspicious", key: "suspicious", width: 14 },
    { header: "Last Updated (UTC)", key: "lastUpdated", width: 22 },
  ];

  attendanceSheet.addRows(
    records.map((record) => ({
      studentName: record.student?.name || "Unknown",
      studentEmail: record.student?.email || "",
      section: record.student?.section || "",
      status: record.status || "Pending",
      insideTime: Number((record.insideTime || 0).toFixed(2)),
      boundaryCrossings: record.boundaryCrossings || 0,
      suspicious: record.isSuspicious ? "Yes" : "No",
      lastUpdated: formatDateTime(record.lastUpdated),
    }))
  );

  attendanceSheet.getRow(1).font = { bold: true };
  attendanceSheet.getRow(1).alignment = { horizontal: "center", vertical: "middle" };

  return workbook.xlsx.writeBuffer();
};

module.exports = { generateAttendanceWorkbook };
