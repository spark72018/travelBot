$(document).ready(function() {
	//Hide back-to-top btn at first
	$(".back-to-top").hide();

	//Scroll to top of the document when click on back to top btn
	$(".back-to-top a").click(function () {
		$("body, html").animate({
			scrollTop: 0
		}, 700);
		return false;
	});


	//Fn to fade in divs on scroll
	function fadeDiv() {
        $(".main-section").each(function() {
            var bottomOfObject = $(this).position().top;
            var bottomOfWindow = $(window).scrollTop() + $(window).height();
            
            //Fade in div
            if (bottomOfWindow > bottomOfObject) {
                $(this).animate({
                	"opacity": "1"
                }, 1200);      
            }  
        }); 
	}
	
	$(window).scroll(function () {
		//Fade in back-to-top btn when scroll 200px down 
		if ($(this).scrollTop() > 200) {
			$(".back-to-top").fadeIn(1000);
		} else {
			$(".back-to-top").fadeOut();
		}

		//Animate background position y on scroll
		$("body").css("background-position-y", parseInt($(this).scrollTop()*-0.3));

		//Fade in divs on scroll
		fadeDiv();
	});
});