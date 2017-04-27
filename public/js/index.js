$(document).ready(function() {
	function fadeDiv() {
        $('.main-section').each(function() {
            var bottomOfObject = $(this).position().top;
            var bottomOfWindow = $(window).scrollTop() + $(window).height();
            
            //Fade in div
            if (bottomOfWindow > bottomOfObject) {
                $(this).animate({'opacity':'1'}, 1200);      
            }  
        }); 
	}

	//Hide back-to-top btn at first
	$(".back-to-top").hide();
	
	$(window).scroll(function () {
		//Fade in back-to-top btn
		if ($(this).scrollTop() > 200) {
			$('.back-to-top').fadeIn(1000);
		} else {
			$('.back-to-top').fadeOut();
		}

		//Animate background position y on scroll
		$('body').css("background-position-y", parseInt($(this).scrollTop()*0.1));

		//Fade div call back
		fadeDiv();
	});

	//Scroll body to 0px on click
	$('.back-to-top a').click(function () {
		$('body, html').animate({
			scrollTop: 0
		}, 700);
		return false;
	});
});