const express = require('express');
const router = express.Router();
const dataController = require('../controllers/dataController');
const ptdController = require('../controllers/ptdController');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const projectController = require('../controllers/projectController');
const path = require('path');
// ASBL Update route
const asblController = require('../controllers/asblController');
const authController = require('../controllers/authController');



// In teeno routes ke naam controller ke function se match hone chahiye
router.get('/wbs-summary', dataController.getWbsSummary);
router.get('/filter-options', dataController.getFilterOptions); // Is line ki wajah se crash ho raha tha
router.get('/export-excel', dataController.exportToExcel);
router.get('/categories', dataController.getCategories);
router.post('/save-project', dataController.saveProjectData);
router.post('/update-non-committed', dataController.updateNonCommitted);
router.post('/ptd-automation', upload.single('file'), ptdController.uploadPtdData);
router.get('/review-changes', dataController.getReviewChanges);
router.post('/finalize-changes', dataController.finalizeChanges);
router.post('/process-project-paste', projectController.processProjectPaste);
router.get('/download-template', (req, res) => {
    const filePath = path.join(__dirname, '../../ASBL_Data_Template.xlsx');
    res.download(filePath);
});

router.post('/login', authController.login);

router.get('/dashboard-filters', dataController.getDashboardFilters);

router.get('/analytics-bu', dataController.getBuAnalytics);

router.get('/analytics-loa', dataController.getLoaAnalytics);

router.post('/full-refresh', dataController.fullRefresh);

// Project Template download karne ka route
router.get('/download-project-template', (req, res) => {
    // Aapke bataye huye path ke hisaab se
    const filePath = path.join(__dirname, '../../Add_New_Project.xlsx');
    res.download(filePath, 'Add_New_Project.xlsx', (err) => {
        if (err) {
            res.status(500).send("Template file not found on server.");
        }
    });
});

router.get('/project-details', asblController.getProjectDetails);
router.post('/update-manual-asbl', asblController.updateManualAsbl);

// ASBL Update route
router.post('/process-asbl-update', asblController.processAsblUpdate);
// ASBL Template download karne ka route
router.get('/download-asbl-template', (req, res) => {
    const filePath = path.join(__dirname, '../../ASBL_Data_Template.xlsx');
    res.download(filePath, 'ASBL_Data_Template.xlsx', (err) => {
        if (err) res.status(500).send("ASBL Template not found.");
    });
});


const adminController = require('../controllers/adminController');
router.get('/admin/users', adminController.getAllUsers);
router.post('/admin/create-user', adminController.createUser);
router.post('/admin/update-user', adminController.updateUser);
router.delete('/admin/delete-user', adminController.deleteUser);

router.post('/clear-draft', dataController.clearDraftChanges);
router.get('/export-review', dataController.exportReviewExcel);
router.post('/finalize-changes', dataController.finalizeChanges);

router.get('/check-pending-changes', dataController.checkPendingChanges);

// Dashboard table Cost view & BU View related routes
router.get('/final-dashboard-table', dataController.getFinalDashboardTable);

router.get('/cost-view-table', dataController.getCostViewTable);


module.exports = router;