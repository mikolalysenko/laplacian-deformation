s0 = '"positions":['
s1 = '"cells":['

model = "../meshes/armadillo_low_res"

with open(model+'.ply') as f:
    c = 0
    d = 0

    passed_header = False

    for line in f:
#        print line
        if line.startswith('end_header'):
            passed_header = True
            continue

        if not passed_header:
            continue



        if line.startswith('3 '):

            # if c > 10:
            #     break

            t = line[2:]
            tokens = t.split()
            complete = '[' + ','.join(tokens) +  '],'
            s1 = s1 + complete

            c = c + 1


        # parsing code here.
        else:
            d = d + 1

            # if d > 10:
            #     break

            tokens = line.split()
            complete = '[' + ','.join(tokens) +  '],'
            s0 = s0 + complete


s0 = s0[:-1]
s0 = s0 + ']'

s1 = s1[:-1]
s1 = s1 + ']'


#print s0
text_file = open(model+".json", "w")
text_file.write('{')
text_file.write(s0)
text_file.write(',')
text_file.write(s1)
text_file.write('}')

text_file.close()
