$(document).ready(function(){
  console.log('Ready')

  $('#printButton').click( () => {
    // console.log("Clicked")
    window.print();
  })

  // $.get('/bot', (result) => {
  //   $(".content").html(`${result.data}`)
  // })

  // $.post('/bot'), (data) => {
  //   console.log(`Bot test: ${data}`);
  // }


})
