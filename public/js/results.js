
$(document).ready(function () {
  $('#answersTable').DataTable({
    "searching": false, "bLengthChange": false, "pageLength": 10, responsive: true
    });
    $('.dataTables_length').addClass('bs-select');

  $('#csvButton').click( () => {
    $("#answersTable").table2excel({ 
      filename: "Answers.xls" 
    }); 
  });
})




  
     //   "bPaginate": false,
       // "bLengthChange": false,
        //"bFilter": true,
        //"bInfo": false,
       /// "bAutoWidth": false
 