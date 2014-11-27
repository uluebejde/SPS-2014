<?php
	header("Content-type: text/xml");
	$id = $_GET['id'];
	
	echo '<?xml version="1.0" encoding="UTF-8"?>';
	
	
	if (isset($id) && $id == '1') {
		echo '
<root storyId="1" compiletime="1.0644779205322">
	<facebook results="23" querytime="0.2483" cached="false">
		<comment>
			<name>Tina Mainardis</name>
			<time>18.05.2010</time>
			<text>Juhuu Endlich ist es soweit, unser Video ist onlineEcht super</text>
		</comment>
		<comment>
			<name>Kalischko Rena</name>
			<time>18.05.2010</time>
			<text>Großes Lob an unsere Studenten, habt ihr supertoll gemacht :-))</text>
		</comment>
		<comment>
			<name>Alexander Keijer</name>
			<time>18.05.2010</time>
			<text>Mhh..ist das eingentlich im Stammhaus </text>
		</comment>
		<comment>
			<name>Lin Eska</name>
			<time>18.05.2010</time>
			<text>Michii der superhero</text>
		</comment>
		<comment>
			<name>Fatima Celik</name>
			<time>18.05.2010</time>
			<text>wow tolles videoo :))) echt gut geworden :) </text>
		</comment>
	</facebook>
	<twitter results="0" querytime="0.7780" cached="false"/>
	<youtube results="" querytime="" cached=""/>
</root>';
	}
	elseif (isset($id) && $id == '2') {
		echo '
<root storyId="2" compiletime="1.0644779205322">
	<facebook results="25" querytime="0.2483" cached="false">
		<comment>
			<name>Tina Mainardis</name>
			<time>18.05.2010</time>
			<text>Juhuu Endlich ist es soweit, unser Video ist onlineEcht super</text>
		</comment>
		<comment>
			<name>Kalischko Rena</name>
			<time>18.05.2010</time>
			<text>Großes Lob an unsere Studenten, habt ihr supertoll gemacht :-))</text>
		</comment>
		<comment>
			<name>Alexander Keijer</name>
			<time>18.05.2010</time>
			<text>Mhh..ist das eingentlich im Stammhaus </text>
		</comment>
		<comment>
			<name>Lin Eska</name>
			<time>18.05.2010</time>
			<text>Michii der superhero</text>
		</comment>
		<comment>
			<name>Fatima Celik</name>
			<time>18.05.2010</time>
			<text>wow tolles videoo :))) echt gut geworden :) </text>
		</comment>
	</facebook>
	<twitter results="0" querytime="0.7780" cached="false"/>
	<youtube results="" querytime="" cached=""/>
</root>';
	} else {
	echo '
<root>
	<story id="1">
		<facebook id="123" amount="3"/>
		<twitter id="42863487" amount="9999"/>
		<youtube id="42863488" amount="112"/>
	</story>
	<story id="2">
		<facebook id="123" amount="3"/>
		<twitter id="42863487" amount="9999"/>
		<youtube id="42863488" amount="112"/>
	</story>
	<story id="3">
		<facebook id="123" amount="3"/>
		<twitter id="428php63487" amount="9999"/>
		<youtube id="42863488" amount="112"/>
	</story>
	<story id="4">
		<facebook id="123" amount="3"/>
		<twitter id="42863487" amount="9999"/>
		<youtube id="42863488" amount="112"/>
	</story>
</root>';
	}
?>