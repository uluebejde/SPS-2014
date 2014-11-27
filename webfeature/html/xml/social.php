<?php
	header("Content-type: text/xml");
	$id = $_GET['id'];
	$media = $_GET['media'];
	
	echo '<?xml version="1.0" encoding="UTF-8"?>';
	
	if (isset($id) && isset($media) && $media == 'facebook') {
		echo <<<EOX
<root media="facebook" id="4325435">
	<commment text="lorem ispum" time="1274180710" name="John Doe" />
	<commment text="lorem ispum 1" time="1274180711" name="John Doe" />
	<commment text="lorem ispum 2" time="1274180712" name="Jane Doe" />
	<commment text="lorem ispum 3" time="1274180713" name="John Doe's Brother"/>
	<commment text="lorem ispum 4" time="1274180714" name="John Doe's Sister"/>
</root>
EOX;
	} elseif (isset($id) && isset($media) && $media == 'twitter') {
		echo <<<EOX
<root media="twitter" querry="wwww.siemens.com/answers/storyx AND thiny.url/sdfdsua">
	<commment text="lorem ispum" time="1274180710" name="John Doe" />
	<commment text="lorem ispum 1" time="1274180711" name="John Doe" />
	<commment text="lorem ispum 2" time="1274180712" name="Jane Doe" />
	<commment text="lorem ispum 3" time="1274180713" name="John Doe's Brother"/>
	<commment text="lorem ispum 4" time="1274180714" name="John Doe's Sister"/>
</root>
EOX;
	}
	elseif (isset($id) && isset($media) && $media == 'youtube') {
		echo <<<EOX
<root media="youtube" id="4325435">
	<commment text="lorem ispum" time="1274180710" name="John Doe" />
	<commment text="lorem ispum 1" time="1274180711" name="John Doe" />
	<commment text="lorem ispum 2" time="1274180712" name="Jane Doe" />
	<commment text="lorem ispum 3" time="1274180713" name="John Doe's Brother"/>
	<commment text="lorem ispum 4" time="1274180714" name="John Doe's Sister"/>
</root>
EOX;
	} else {
		echo <<<EOX
			<root storyId="$id" compiletime="0.010561943054199">
				<error message="No Story with ID $id defined."/>
			</root>
EOX;
	}
?>