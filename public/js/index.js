$(document).ready(function() {


	// hide back-to-top first
	$(".back-to-top").hide();
	
	// fade in back-to-top, background position y
	$(window).scroll(function () {
		if ($(this).scrollTop() > 200) {
			$('.back-to-top').fadeIn(1000);
		} else {
			$('.back-to-top').fadeOut();
		}
		//Animate background on scroll
		$('body').css("background-position-y", parseInt($(this).scrollTop()*0.1));
	});

	// scroll body to 0px on click
	$('.back-to-top a').click(function () {
		$('body, html').animate({
			scrollTop: 0
		}, 700);
		return false;
	});

});