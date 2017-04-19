$(document).ready(function(){

	// hide back-to-top first
	$(".back-to-top").hide();
	
	// fade in back-to-top
	$(function () {
		$(window).scroll(function () {
			if ($(this).scrollTop() > 200) {
				$('.back-to-top').fadeIn(1000);
			} else {
				$('.back-to-top').fadeOut();
			}
		});

		// scroll body to 0px on click
		$('.back-to-top a').click(function () {
			$('body, html').animate({
				scrollTop: 0
			}, 700);
			return false;
		});
	});

	// $('.main-section').hide();

});