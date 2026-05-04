const reportService = require("../../services/reportService");
const moment = require("moment");

const loadSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, filter } = req.query;
        
        let start = startDate;
        let end = endDate;

        if (filter === 'today') {
            start = moment().startOf('day').format('YYYY-MM-DD');
            end = moment().endOf('day').format('YYYY-MM-DD');
        } else if (filter === 'week') {
            start = moment().startOf('week').format('YYYY-MM-DD');
            end = moment().endOf('week').format('YYYY-MM-DD');
        } else if (filter === 'month') {
            start = moment().startOf('month').format('YYYY-MM-DD');
            end = moment().endOf('month').format('YYYY-MM-DD');
        } else if (filter === 'year') {
            start = moment().startOf('year').format('YYYY-MM-DD');
            end = moment().endOf('year').format('YYYY-MM-DD');
        }

        // Default to last 30 days if no dates provided
        if (!start || !end) {
            start = moment().subtract(30, 'days').format('YYYY-MM-DD');
            end = moment().format('YYYY-MM-DD');
        }

        const reportData = await reportService.getSalesReport(start, end);
        
        res.render("sales-report", {
            reportData,
            startDate: start,
            endDate: end,
            filter
        });
    } catch (error) {
        console.error("Error loading sales report:", error);
        res.redirect("/admin/pageError");
    }
};

const downloadPdf = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const reportData = await reportService.getSalesReport(startDate, endDate);
        const pdfBuffer = await reportService.generatePdfReport(reportData, startDate, endDate);
        
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=sales-report-${startDate}-to-${endDate}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error("Error downloading PDF:", error);
        res.status(500).send("Error generating PDF report");
    }
};

const downloadExcel = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const reportData = await reportService.getSalesReport(startDate, endDate);
        const excelBuffer = await reportService.generateExcelReport(reportData, startDate, endDate);
        
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename=sales-report-${startDate}-to-${endDate}.xlsx`);
        res.send(excelBuffer);
    } catch (error) {
        console.error("Error downloading Excel:", error);
        res.status(500).send("Error generating Excel report");
    }
};

module.exports = {
    loadSalesReport,
    downloadPdf,
    downloadExcel
};
