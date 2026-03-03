
a = 150/2;
b = 180/2;
d = 120;

scale(0.001)
union(){

cube([3*a,50,50],center=true);

translate([-a,-b,0])cylinder(r=d/2,h=5,$fn=50);
translate([+a,-b,0])cylinder(r=d/2,h=5,$fn=50);
translate([-a,b,0])cylinder(r=d/2,h=5,$fn=50);
translate([+a,b,0])cylinder(r=d/2,h=5,$fn=50);


hull(){
translate([-a,-b,-5])cylinder(r=10,h=5,$fn=50);
translate([0,0,0])cylinder(r=10,h=5,$fn=50);
}

hull(){
translate([+a,-b,-5])cylinder(r=10,h=5,$fn=50);
translate([0,0,0])cylinder(r=10,h=5,$fn=50);
}


hull(){
translate([-a,b,-5])cylinder(r=10,h=5,$fn=50);
translate([0,0,0])cylinder(r=10,h=5,$fn=50);
}
 
hull(){
translate([+a,b,-5])cylinder(r=10,h=5,$fn=50);
translate([0,0,0])cylinder(r=10,h=5,$fn=50);
}


hull(){
translate([-3*a/2+10,0,-5])cylinder(r=10,h=5,$fn=50);
translate([-3*a/2-40,0,-90])cylinder(r=10,h=5,$fn=50);
}

translate([-3*a/2-40,0,-90])cylinder(r=30,h=5,$fn=50);

}