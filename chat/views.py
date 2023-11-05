from django.shortcuts import render

# Create your views here.

def main_view(req):
    # contex={}
    return render(req,'chat/main.html')